"use client";
export default function SignOut(){return <button style={{position:"fixed",bottom:16,right:20,zIndex:80,background:"white",border:"1px solid #d4ddc8",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#526742"}} onClick={async()=>{await fetch("/api/logout",{method:"POST"});location.assign("/login");}}>Sign out</button>;}
