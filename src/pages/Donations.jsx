import React from "react";
import { Banknote } from "lucide-react";
import DonationsEvents from "@/pages/DonationsEvents";

export default function Donations() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <Banknote className="w-6 h-6 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">תרומות חגים</h1>
          <p className="text-sm text-muted-foreground">אירועי התרמה וקמפיינים קהילתיים</p>
        </div>
      </div>
      <DonationsEvents />
    </div>
  );
}