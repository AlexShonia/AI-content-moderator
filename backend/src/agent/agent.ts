import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import { z } from "zod";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "node_modules/@langchain/core/tools";


type Input =
    | { type: "text"; text: string }
    | { type: "image"; buffer: Buffer; filename?: string; mimetype?: string };

const AgentState = Annotation.Root({
    input: Annotation<Input>,
    analysis: Annotation<string>,
    classification: Annotation<string>,
    lastResponse: Annotation<AIMessage | undefined>,
});

export async function moderateContent(input: Input) {

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

    const toolModel = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 512,
    })

    const analyzeContentTool = tool(async (state: typeof AgentState.State) => {

        let response: AIMessage | undefined;
        try {
            if (state.input.type === "text") {
                response = await toolModel.invoke([
                    new SystemMessage("You are a Text Analyzer. Be concise and neutral."),
                    new HumanMessage({
                        content: `Analyze the following text and summarize any policy-relevant signals: "${state.input.text}"`,
                    }),
                ]);
            } else if (state.input.type === "image") {
                const base64Image = state.input.buffer.toString("base64");
                const mimetype = state.input.mimetype || "image/png";

                try {
                    response = await toolModel.invoke([
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

        return { analysis: response?.content };
    }, { name: "analyze_content", description: "Analyze content for policy-relevant signals" });


    const classifyContentTool = tool(async (state: typeof AgentState.State) => {
        const analysis = state.analysis || "No analysis available";

        try {
            const response = await toolModel.invoke([
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
    }, { name: "classify_decision", description: "Classify content based on analysis" });


    const tools = [analyzeContentTool, classifyContentTool];

    async function toolRouter(state: typeof AgentState.State) {
        const last = state.lastResponse;
        if (!last?.tool_calls?.length) {
            return {};
        }

        for (const call of last.tool_calls) {

            if (call.name === "analyze_content") {
                const result = await analyzeContentTool.func(state);
                return { analysis: result.analysis };
            }
            if (call.name === "classify_decision") {
                const result = await classifyContentTool.func(state);
                return { classification: result.classification };
            }
        }

        return {};
    }

    const agentModel = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 1024
    }).bindTools(tools);

    async function agentNode(state: typeof AgentState.State) {


        const response = await agentModel.invoke([
            new SystemMessage(`
                You are a moderation agent controlling a content moderation workflow.

                Rules:
                - If there is NO analysis yet, call the tool "analyze_content".
                - If analysis exists but NO classification yet, call "classify_decision".
                - If classification already exists, respond with the word "finish" (no tool call).
                
                Tools available:
                - analyze_content: analyze the input content for policy-relevant signals.
                - classify_decision: classify content based on analysis.
            `),

            new HumanMessage({
                content: `
                Current input: ${JSON.stringify(state.input.type === "text" ? state.input.text : "User submitted an image")}
                Analysis: ${state.analysis || "none"}
                Classification: ${state.classification || "none"}
            `,
            }),
        ]);

        return { lastResponse: response };
    }

    function shouldContinue(state: typeof AgentState.State) {
        const last = state.lastResponse;

        if (last?.tool_calls?.length) {
            return "toolRouter";
        }

        return END;
    }


    const workflow = new StateGraph(AgentState)
        .addNode("agent", agentNode)
        .addNode("toolRouter", toolRouter)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue, ["toolRouter", END])
        .addEdge("toolRouter", "agent")


    const app = workflow.compile();

    try {
        const response = await app.invoke({ input: parsedInput.data });
        return { classification: response.classification, analysis: response.analysis };
    } catch (err) {
        console.error("moderateContent workflow error:", err);
        return { analysis: "", classification: "flagged" } as any;
    }
}