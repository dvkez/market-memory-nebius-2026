"use client";
import { useEffect,useRef,useState } from "react";
import type { Metrics,ChartSpec } from "@/lib/domain";
export default function Chart({metrics,kind}:{metrics:Metrics;kind:ChartSpec["kind"]}) {
  const ref=useRef<HTMLDivElement>(null);const [error,setError]=useState(false);
  useEffect(()=>{
    if(!ref.current||!metrics.sessions.length)return;
    let cancelled=false;let cleanup:()=>void=()=>{};
    import("plotly.js-basic-dist-min").then(async({default:Plotly})=>{
      if(cancelled||!ref.current)return;
      const el=ref.current,points=metrics.sessions;let data:unknown[]=[];
      const axes={gridcolor:"#e9ede3",zerolinecolor:"#dde4d3",tickfont:{color:"#8a967d",size:10}};
      const layout:Record<string,unknown>={autosize:true,margin:{t:20,r:52,b:40,l:56},paper_bgcolor:"transparent",plot_bgcolor:"transparent",font:{family:"Arial, sans-serif",color:"#65705c"},showlegend:false,hovermode:"x unified",xaxis:{...axes,type:"date",showgrid:false},yaxis:{...axes,tickprefix:"$"},hoverlabel:{bgcolor:"#fff",bordercolor:"#d8dfd0"},dragmode:"pan"};
      if(kind==="price_sentiment"){
        data=[{x:points.map(p=>p.date),y:points.map(p=>p.close),type:"scatter",mode:"lines",name:"Close (unadjusted)",line:{color:"#699443",width:2.4},hovertemplate:"$%{y:.2f}<extra>Close</extra>"},{x:points.map(p=>p.date),y:points.map(p=>p.sentiment),type:"scatter",mode:"lines+markers",name:"Observed sentiment",connectgaps:false,yaxis:"y2",line:{color:"#aa94bf",width:1.8,dash:"dot"},marker:{size:4},hovertemplate:"%{y:.2f}<extra>Sample sentiment</extra>"}];
        layout.yaxis2={...axes,overlaying:"y",side:"right",range:[-1.1,1.1],showgrid:false,tickvals:[-1,0,1]};
      }else if(kind==="volume"){
        data=[{x:points.map(p=>p.date),y:points.map(p=>p.volume),type:"bar",marker:{color:points.map(p=>(p.returnPct??0)>=0?"#b2d88b":"#d3bddc")},hovertemplate:"%{y:,.0f} shares<extra>Daily volume</extra>"}];layout.yaxis={...axes,tickformat:".2s"};
      }else{
        const pairs=points.flatMap((p,i)=>p.sentiment!==null&&points[i+1]?.returnPct!=null?[{sentiment:p.sentiment,returnPct:points[i+1].returnPct,date:p.date}]:[]);
        data=[{x:pairs.map(p=>p.sentiment),y:pairs.map(p=>p.returnPct),text:pairs.map(p=>p.date),type:"scatter",mode:"markers",marker:{color:"#77994f",size:8,opacity:.7},hovertemplate:"%{text}<br>Sentiment %{x:.2f}<br>Next-session return %{y:.2f}%<extra></extra>"}];
        layout.xaxis={...axes,range:[-1.1,1.1],title:{text:"Observed sentiment"}};layout.yaxis={...axes,ticksuffix:"%",title:{text:"Next-session return"}};layout.hovermode="closest";
      }
      try{await Plotly.react(el,data,layout,{responsive:true,displaylogo:false,displayModeBar:false,scrollZoom:false});}catch{if(!cancelled)setError(true);}
      if(cancelled){Plotly.purge(el);return;}
      const observer=new ResizeObserver(()=>{if(!cancelled)Plotly.Plots.resize(el);});observer.observe(el);cleanup=()=>{observer.disconnect();Plotly.purge(el);};
    }).catch(()=>{if(!cancelled)setError(true);});
    return()=>{cancelled=true;cleanup();};
  },[metrics,kind]);
  if(kind==="scatter"&&metrics.correlations.some(c=>c.reason?.startsWith("Corporate")))return <div className="chart-empty"><p className="muted">Correlation plot unavailable until corporate actions are verified.</p></div>;
  if(error)return <div className="chart-empty">Chart unavailable. The series remains available in the analysis export.</div>;
  return <div className="plot" ref={ref} role="img" aria-label={kind==="price_sentiment"?"Daily price and observed sentiment":kind==="volume"?"Daily volume":"Sentiment versus next-session returns"}/>;
}
