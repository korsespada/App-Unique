import { Clock, HelpCircle, Package, User } from "lucide-react";
import React from "react";

import { AppView } from "../types";

type Props = {
    setCurrentView: (v: AppView) => void;
};

export default function ProfileView({ setCurrentView }: Props) {
    const tg = (window as any)?.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    const avatarUrl = user?.photo_url;
    const initial = user?.first_name ? user.first_name[0].toUpperCase() : "U";
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    const username = user?.username ? `@${user.username}` : "";

    return (
        <div className="min-h-screen animate-in fade-in bg-black pb-32 pt-12 text-white duration-500">
            <div className="mb-10 flex flex-col items-center px-4">
                <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white/10 bg-white/5 shadow-2xl">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-4xl font-bold text-white/40">{initial}</span>
                    )}
                </div>
                <h2 className="mb-1 text-2xl font-bold">{fullName || "Пользователь"}</h2>
                {username && <p className="text-sm font-medium text-white/40">{username}</p>}
            </div>

            <div className="space-y-3 px-4">
                <button
                    onClick={() => setCurrentView("orders")}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 active:scale-[0.98]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
                        <Clock size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-semibold">История заказов</h3>
                        <p className="text-xs text-white/40">Статус и детали ваших покупок</p>
                    </div>
                </button>

                <button
                    onClick={() => window.open("https://t.me/htsadmin", "_blank")}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 active:scale-[0.98]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20">
                        <HelpCircle size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-semibold">Поддержка</h3>
                        <p className="text-xs text-white/40">Связаться с менеджером</p>
                    </div>
                </button>
            </div>

            <div className="mt-12 px-8 text-center">
                <p className="text-xs text-white/20">
                    ID: {user?.id} <br />
                    Version 1.0.0
                </p>
            </div>
        </div>
    );
}
