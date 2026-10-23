import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaintenanceRequestForm from "./MaintenanceRequestForm";

export default function MaintenanceRequestFormDialog({ open, onClose, onCreated }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>קריאת אחזקה חדשה</DialogTitle>
        </DialogHeader>
        <MaintenanceRequestForm
          submitLabel="שלח קריאה"
          onSubmitted={() => {
            onCreated?.();
            onClose?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}