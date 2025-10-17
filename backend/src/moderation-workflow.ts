import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import { z } from "zod";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";



type AnalyzeInput =
    | { type: "text"; text: string }
    | { type: "image"; buffer: Buffer; filename?: string; mimetype?: string };

const StateAnnotation = Annotation.Root({
    input: Annotation<AnalyzeInput>,
    analysis: Annotation<string>,
    classification: Annotation<string>,
    explanation: Annotation<string>,
});

export async function moderateContent(input: AnalyzeInput) {

    function getRules() {
        // In a real implementation, will fetch from a database or API
        const rules = { "text": ["no hate speech", "no adult content"], "image": ["no violence", "no adult content"] };
        return rules;
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim().length === 0) {
        throw new Error("OPENAI_API_KEY is not set. Please configure it in your environment.");
    }

    const AnalyzeInputSchema = z.union([
        z.object({ type: z.literal("text"), text: z.string().min(1, "text cannot be empty") }),
        z.object({
            type: z.literal("image"),
            buffer: z.custom<Buffer>((val) => Buffer.isBuffer(val), {
                message: "buffer must be a Node.js Buffer",
            }),
            filename: z.string().optional(),
            mimetype: z.string().optional(),
        }),
    ]);

    const parsedInput = AnalyzeInputSchema.safeParse(input);
    if (!parsedInput.success) {
        throw new Error(`Invalid input: ${parsedInput.error.message}`);
    }

    const model = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 512,
    });

    async function analyzeContent(state: typeof StateAnnotation.State) {
        console.log("analyzing state: ", state);

        let response: AIMessage | undefined;
        try {
            if (state.input.type === "text") {
                response = await model.invoke([
                    new SystemMessage("You are a Text Analyzer. Be concise and neutral."),
                    new HumanMessage({
                        content: `Analyze the following text and summarize any policy-relevant signals: "${state.input.text}"`,
                    }),
                ]);
            } else if (state.input.type === "image") {
                const base64Image = state.input.buffer.toString("base64");
                const mimetype = state.input.mimetype || "image/png";

                try {
                    response = await model.invoke([
                        new SystemMessage("You are an Image Analyzer. Be concise and neutral."),
                        new HumanMessage({
                            content: [
                                { type: "text", text: "Analyze the following image." },
                                {
                                    type: "image_url", image_url: {
                                        url: `data:${mimetype};base64,${base64Image}`,
                                    },
                                },
                            ],
                        }),
                    ]);
                } catch (err) {
                    console.error("Image analysis failed.", err);

                    // Fallback to older/alternative image shape
                    // response = await model.invoke([
                    //     new HumanMessage({
                    //         content: [
                    //             {
                    //                 type: "image",
                    //                 image: base64Image,
                    //                 filename: state.input.filename,
                    //                 mimetype: state.input.mimetype,
                    //             },
                    //         ],
                    //     }),
                    // ]);
                }
            } else {
                throw new Error("Unsupported input type");
            }
        } catch (err) {
            console.error("analyzeContent error:", err);
            return { analysis: "" };
        }

        console.log("analysis response: ", response);
        return { analysis: response?.content };
    }

    async function classifyDecision(state: typeof StateAnnotation.State) {
        const analysis = state.analysis || "No analysis available";
        console.log("classify state: ", state);


        try {
            const response = await model.invoke([
                new SystemMessage(
                    `You are a content classification agent. Classify the content as 'approved', 'flagged for review', or 'rejected', based on the latest rules. ${JSON.stringify(
                        getRules()
                    )}. Respond with just one word exactly: approved, flagged, or rejected.`
                ),
                new HumanMessage({ content: analysis }),
            ]);

            return { classification: response.content };
        } catch (err) {
            console.error("classifyDecision error:", err);
            return { classification: "flagged" };
        }
    }

    async function explainFlaggedContent(state: typeof StateAnnotation.State) {
        console.log("explain state: ", { classification: state.classification, hasAnalysis: !!state.analysis });
        const promptAnalysis = state.analysis || "No prior analysis available.";
        const classification = (state.classification || "flagged").toString();

        try {
            const response = await model.invoke([
                new SystemMessage(
                    "You are a content moderation assistant. Briefly explain in one or two sentences why the content may require a manual review."
                ),
                new HumanMessage({ content: `${promptAnalysis}\nClassification: ${classification}` }),
            ]);

            console.log("analysis: ", response);

            return { explanation: response.content };
        } catch (err) {
            console.error("explainFlaggedContent error:", err);
            return { explanation: "Additional review recommended, but an explanation could not be generated." };
        }
    }

    function shouldExplain(state: typeof StateAnnotation.State) {
        console.log("should explain state: ", { classification: state.classification });
        const cls = (state.classification || "").toString().toLowerCase().trim();

        // pesudo-random logic for demo purposes
        if (cls.includes("flag")) {
            const reasonUnclear = Math.random() < 0.5;
            if (reasonUnclear) return "explain_flagged_content";
        }
        return END;
    }

    const workflow = new StateGraph(StateAnnotation)
        .addNode("analyze_content", analyzeContent)
        .addNode("classify_decision", classifyDecision)
        .addNode("explain_flagged_content", explainFlaggedContent)
        .addEdge(START, "analyze_content")
        .addEdge("analyze_content", "classify_decision")
        .addConditionalEdges("classify_decision", shouldExplain)
        .addEdge("explain_flagged_content", END);

    const app = workflow.compile();

    try {
        const response = await app.invoke({ input: parsedInput.data });
        return { classification: response.classification, analysis: response.analysis, explanation: response.explanation };
    } catch (err) {
        console.error("moderateContent workflow error:", err);
        return { analysis: "", classification: "flagged", explanation: undefined } as any;
    }
}