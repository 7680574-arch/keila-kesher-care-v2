import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Sparkles, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import AiAvatar from "./AiAvatar";
import { motion, AnimatePresence } from "framer-motion";

const neuInset = {
  background: "#ebe7e2",
  boxShadow: "inset -3px -3px 6px rgba(255,250,244,0.68), inset 3px 3px 6px rgba(160,143,126,0.22)",
  borderRadius: 10,
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: 13,
  color: "#3a3a3a",
  boxSizing: "border-box",
};

const NeuInput = ({ style, ...props }) => <input {...props} style={{ ...neuInset, padding: "9px 14px", ...style }} />;
const NeuTextarea = ({ style, ...props }) => <textarea {...props} style={{ ...neuInset, padding: "10px 14px", resize: "vertical", fontFamily: "inherit", ...style }} />;
const FieldLabel = ({ children }) => <p style={{ fontSize: 12, fontWeight: 600, color: "#6e6e6e", marginBottom: 7 }}>{children}</p>;

const NeuBtn = ({ children, onClick, disabled, dark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "9px 18px", borderRadius: 10, border: "none", cursor: disabled ? "default" : "pointer",
      fontSize: 11, fontWeight: 600, transition: "box-shadow 0.15s ease", opacity: disabled ? 0.5 : 1,
      ...(dark
        ? { background: "#3a3a3a", color: "#f1f1f0", boxShadow: "-4px -4px 8px rgba(255,255,255,0.085), 4px 4px 10px rgba(0,0,0,0.30)" }
        : { background: "#eeeae6", color: "#3a3a3a", boxShadow: "-5px -5px 10px rgba(255,250,244,0.78), 5px 5px 12px rgba(160,143,126,0.27)" }
      ),
    }}
  >
    {children}
  </button>
);

export default function GoalCreationWizard({ teamMembers, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [targetDate, setTargetDate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [proposedTasks, setProposedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [goalId, setGoalId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "true") return;
  }, []);

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const memberNames = teamMembers.map((m) => m.name || m.email).join(", ");
      const res = await base44.functions.invoke("projectAiWizard", {
        step: "questions",
        goalTitle, goalDescription,
        targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
        teamMembers: teamMembers.map((m) => ({ name: m.name, email: m.email })),
      });
      setQuestions(res?.data?.questions || []);
      setStep(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateTasks = async () => {
    setLoading(true);
    try {
      const memberInfo = teamMembers.map((m) => ({ id: m.id, name: m.name, email: m.email }));
      const qaPairs = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || "אין תשובה"}`).join("\n\n");

      const goal = await base44.entities.Goal.create({
        title: goalTitle,
        description: goalDescription,
        status: "draft",
        target_date: targetDate ? format(targetDate, "yyyy-MM-dd") : undefined,
        clarifying_questions: JSON.stringify(questions.map((q, i) => ({ question: q, answer: answers[i] || "" }))),
        ai_context: qaPairs,
      });
      setGoalId(goal.id);

      const res = await base44.functions.invoke("projectAiWizard", {
        step: "tasks",
        goalTitle, goalDescription,
        targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
        questions, answers,
        teamMembers: memberInfo,
      });
      setProposedTasks(res?.data?.tasks || []);
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveAndCreate = async () => {
    setLoading(true);
    try {
      await base44.entities.Goal.update(goalId, { status: "active" });
      await Promise.all(
        proposedTasks.map((t, i) =>
          base44.entities.ProjectTask.create({
            title: t.title,
            description: t.description,
            goal_id: goalId,
            goal_title: goalTitle,
            assignee_id: t.assignee_id,
            assignee_name: t.assignee_name,
            assignee_email: t.assignee_email,
            deadline: t.deadline,
            estimated_hours: t.estimated_hours,
            status: "pending",
            created_by_ai: true,
            order: i,
          })
        )
      );
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (index, field, value) => {
    setProposedTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-start gap-3 mb-6">
              <AiAvatar />
              <div style={{ background: "#eeeae6", boxShadow: "-4px -4px 8px rgba(255,250,244,0.82), 4px 4px 10px rgba(160,143,126,0.28)", borderRadius: "0 14px 14px 14px", padding: "10px 16px", maxWidth: 400 }}>
                <p style={{ fontSize: 13, color: "#3a3a3a", lineHeight: 1.5 }}>ספר/י לי על הפרויקט שלך. מה תרצה/י להשיג? אשאל כמה שאלות לפני שאיצור תוכנית פעולה.</p>
              </div>
            </div>
            <div className="neu-raised" style={{ padding: "22px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#3a3a3a", marginBottom: 20 }}>פרטי הפרויקט</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <FieldLabel>כותרת פרויקט</FieldLabel>
                  <NeuInput placeholder="לדוגמה: השקת קמפיין התרמה עד סוף החודש" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>תיאור (אופציונלי)</FieldLabel>
                  <NeuTextarea placeholder="הוסף הקשר נוסף על איך נראה הצלחה..." value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} style={{ height: 88 }} />
                </div>
                <div>
                  <FieldLabel>תאריך יעד</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button style={{ ...neuInset, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", cursor: "pointer", textAlign: "right", color: targetDate ? "#3a3a3a" : "#9a9a9a" }}>
                        <CalendarIcon style={{ width: 14, height: 14, strokeWidth: 1.5, flexShrink: 0 }} />
                        {targetDate ? format(targetDate, "d בMMM yyyy") : "בחר תאריך יעד"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={targetDate} onSelect={setTargetDate} dir="rtl" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <NeuBtn onClick={onCancel}>ביטול</NeuBtn>
                <NeuBtn dark onClick={generateQuestions} disabled={!goalTitle || loading}>
                  {loading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 0.8s linear infinite" }} /> : <Sparkles style={{ width: 13, height: 13 }} />}
                  המשך
                </NeuBtn>
              </div>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-start gap-3 mb-6">
              <AiAvatar />
              <div style={{ background: "#eeeae6", boxShadow: "-4px -4px 8px rgba(255,250,244,0.82), 4px 4px 10px rgba(160,143,126,0.28)", borderRadius: "0 14px 14px 14px", padding: "10px 16px", maxWidth: 400 }}>
                <p style={{ fontSize: 13, color: "#3a3a3a", lineHeight: 1.5 }}>מצוין! לפני שאפרק את זה למשימות, יש לי כמה שאלות:</p>
              </div>
            </div>
            <div className="neu-raised" style={{ padding: "22px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#3a3a3a", marginBottom: 20 }}>שאלות הבהרה</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {questions.map((q, i) => (
                  <div key={i}>
                    <FieldLabel>{q}</FieldLabel>
                    <NeuTextarea placeholder="התשובה שלך..." value={answers[i] || ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} style={{ height: 72 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <NeuBtn onClick={() => setStep(0)}>
                  <ArrowRight style={{ width: 13, height: 13 }} /> חזור
                </NeuBtn>
                <NeuBtn dark onClick={generateTasks} disabled={loading}>
                  {loading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 0.8s linear infinite" }} /> : <Sparkles style={{ width: 13, height: 13 }} />}
                  צור משימות
                </NeuBtn>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-start gap-3 mb-6">
              <AiAvatar />
              <div style={{ background: "#eeeae6", boxShadow: "-4px -4px 8px rgba(255,250,244,0.82), 4px 4px 10px rgba(160,143,126,0.28)", borderRadius: "0 14px 14px 14px", padding: "10px 16px", maxWidth: 400 }}>
                <p style={{ fontSize: 13, color: "#3a3a3a", lineHeight: 1.5 }}>הנה פירוק המשימות שהצעתי. סקור/י וערוך/י לפי הצורך, ואז אשר/י כדי להפעיל.</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {proposedTasks.map((task, i) => (
                <div key={i} className="neu-raised" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <FieldLabel>כותרת משימה</FieldLabel>
                      <NeuInput value={task.title} onChange={(e) => updateTask(i, "title", e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <FieldLabel>תיאור</FieldLabel>
                      <NeuTextarea value={task.description} onChange={(e) => updateTask(i, "description", e.target.value)} style={{ height: 60 }} />
                    </div>
                    <div>
                      <FieldLabel>אחראי</FieldLabel>
                      <div style={{ ...neuInset, padding: "9px 14px", color: "#3a3a3a", display: "flex", alignItems: "center" }}>
                        {task.assignee_name || "—"}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>תאריך יעד</FieldLabel>
                      <NeuInput type="date" value={task.deadline} onChange={(e) => updateTask(i, "deadline", e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel>שעות מוערכות</FieldLabel>
                      <NeuInput type="number" value={task.estimated_hours} onChange={(e) => updateTask(i, "estimated_hours", parseFloat(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <NeuBtn onClick={() => setStep(1)}>
                <ArrowRight style={{ width: 13, height: 13 }} /> חזור
              </NeuBtn>
              <NeuBtn dark onClick={approveAndCreate} disabled={loading}>
                {loading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 0.8s linear infinite" }} /> : <ArrowLeft style={{ width: 13, height: 13 }} />}
                אשר וצור משימות
              </NeuBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}