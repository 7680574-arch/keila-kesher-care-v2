import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { step, goalTitle, goalDescription, targetDate, questions, answers, teamMembers } = body;

    if (step === 'questions') {
      const memberNames = (teamMembers || []).map(m => m.name || m.email).join(", ");
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a smart project management AI. A team lead wants to create a goal:
Title: "${goalTitle}"
Description: "${goalDescription}"
Target Date: ${targetDate || "Not set"}
Team Members: ${memberNames || "Not specified yet"}

Generate exactly 3 short, focused clarifying questions in HEBREW to better understand scope, priorities, and constraints before breaking this into tasks. Questions should be practical and help create actionable tasks. All questions must be in Hebrew.

Return as JSON.`,
        response_json_schema: {
          type: "object",
          properties: { questions: { type: "array", items: { type: "string" } } }
        }
      });
      return Response.json({ questions: res.questions || [] });
    }

    if (step === 'tasks') {
      const memberInfo = (teamMembers || []).map(m => ({ id: m.id, name: m.name, email: m.email }));
      const qaPairs = (questions || []).map((q, i) => `Q: ${q}\nA: ${(answers && answers[i]) || "No answer"}`).join("\n\n");

      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a project management AI. Break down this goal into actionable tasks.

Goal: "${goalTitle}"
Description: "${goalDescription}"
Target Date: ${targetDate || "End of month"}

Context from clarifying questions:
${qaPairs}

Available team members: ${JSON.stringify(memberInfo)}

Create 4-8 tasks. For each task, suggest the best assignee based on a balanced workload (spread evenly). Set realistic deadlines working backwards from the target date. Give estimated hours for each task. ALL task titles, descriptions and content must be in HEBREW.

Return as JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  assignee_id: { type: "string" },
                  assignee_name: { type: "string" },
                  assignee_email: { type: "string" },
                  deadline: { type: "string" },
                  estimated_hours: { type: "number" }
                }
              }
            }
          }
        }
      });
      return Response.json({ tasks: res.tasks || [] });
    }

    return Response.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}