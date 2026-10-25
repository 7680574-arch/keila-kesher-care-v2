import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const OTHER = "__other__";
const NONE = "__none__";

// value: { email, name }; onChange({ email, name })
// משתמש מהמערכת => email + name. אדם חיצוני => name בלבד (email ריק).
export default function AssigneePicker({ users, value, onChange }) {
  const email = value?.email || "";
  const name = value?.name || "";
  const isExternal = !email && !!name;
  const [otherMode, setOtherMode] = React.useState(isExternal);

  React.useEffect(() => { setOtherMode(!email && !!name); }, [email, name]);

  const selectValue = otherMode ? OTHER : (email || NONE);

  const handle = (v) => {
    if (v === NONE) { setOtherMode(false); onChange({ email: "", name: "" }); }
    else if (v === OTHER) { setOtherMode(true); onChange({ email: "", name: email ? "" : name }); }
    else {
      setOtherMode(false);
      const u = users.find((x) => x.email === v);
      onChange({ email: v, name: u?.name || "" });
    }
  };

  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={handle}>
        <SelectTrigger><SelectValue placeholder="בחר אחראי" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>ללא אחראי</SelectItem>
          {users.map((u) => <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>)}
          <SelectItem value={OTHER}>+ אדם אחר (לא משתמש)</SelectItem>
        </SelectContent>
      </Select>
      {otherMode && (
        <Input
          value={name}
          onChange={(e) => onChange({ email: "", name: e.target.value })}
          placeholder="שם האחראי"
          autoFocus
        />
      )}
    </div>
  );
}