import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import MeetingTabsBar from "@/components/cleaning/MeetingTabsBar";
import MeetingLiveTab from "@/components/cleaning/MeetingLiveTab";

export default function MeetingLiveFullscreen({ meeting, tabs, tab, participants, onTabChange, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" dir="rtl">
      <div className="px-6 pt-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-2 truncate">ישיבה: {meeting.title}</h2>
          <MeetingTabsBar tabs={tabs} tab={tab} onChange={onTabChange} />
        </div>
        <Button variant="outline" onClick={onClose}>סגור</Button>
      </div>
      <div className="flex-1 min-h-0 p-6 flex flex-col">
        <MeetingLiveTab meetingId={meeting.id} participants={participants} />
      </div>
    </div>,
    document.body
  );
}