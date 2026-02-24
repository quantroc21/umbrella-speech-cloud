import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export function useProfile() {
    const [user, setUser] = useState<User | null>(null);
    const [creditBalance, setCreditBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (currentUser: User) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("credit_balance")
                .eq("id", currentUser.id)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
                return;
            }

            setCreditBalance(data?.credit_balance ?? 0);
        } catch (err) {
            console.error("Unexpected error fetching profile:", err);
        }
    };

    const refreshCredits = async () => {
        if (user) {
            await fetchProfile(user);
        }
    };

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
            }
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setCreditBalance(0);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 3. Realtime subscription for credit updates
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`public:profiles:id=eq.${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${user.id}`,
                },
                (payload) => {
                    if (payload.new.credit_balance !== undefined) {
                        setCreditBalance(payload.new.credit_balance);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return { user, creditBalance, refreshCredits, loading };
}
