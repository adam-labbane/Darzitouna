import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login(){

    const [users, setUsers] =useState<any[]>([])

    const getUsers = async () => {
        const {data, error} = await supabase.from("utilisateur").select()

        if (error) {
            console.error(error)
            return;
        }

        setUsers(data)
    }

    useEffect(() => {
        (async () => {
            await getUsers()
        })()
    }, [])

    

    console.log(users)

    return (
        <div>
            <h1>Page Login</h1>
        </div>
    )
}