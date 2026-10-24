import {redirect} from "next/navigation";
import {authenticated} from "@/lib/auth";
import Dashboard from "./dashboard";
import SignOut from "./sign-out";
export const dynamic="force-dynamic";
export default async function Home(){if(!await authenticated())redirect("/login");return <><Dashboard signedIn={true}/><SignOut/></>;}
