import mongoose from "mongoose";

// 1. Kirana Product Schema & Model
const storeProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hindiName: String,
    category: { type: String, required: true },
    price: { type: Number, required: true },
    unit: { type: String, required: true },
    stock: { type: Number, required: true, default: 50 },
    aliases: [String],
}, { timestamps: true });

const StoreProduct = mongoose.models.StoreProduct || mongoose.model("StoreProduct", storeProductSchema, "products");

// 2. Kirana Order Schema & Model
const storeOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    customerName: String,
    customerPhone: String,
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct" },
        productName: String,
        quantity: Number,
        unitPrice: Number,
        subtotal: Number,
    }],
    totalAmount: Number,
    status: { type: String, default: "confirmed" },
    source: { type: String, default: "web" },
}, { timestamps: true });

const StoreOrder = mongoose.models.StoreOrder || mongoose.model("StoreOrder", storeOrderSchema, "orders");

// 3. Initial Catalog Seeder (Runs automatically once if catalog is empty)
const INITIAL_PRODUCTS = [
    { name: "Maggi 2-Minute Noodles", hindiName: "मैगी", category: "Snacks", price: 14, unit: "packet (70g)", stock: 120, aliases: ["maggi", "noodles", "maggie", "magi"] },
    { name: "Amul Taaza Toned Milk", hindiName: "अमूल दूध", category: "Dairy", price: 27, unit: "pouch (500ml)", stock: 45, aliases: ["milk", "doodh", "dudh", "amul milk", "taaza"] },
    { name: "Aashirvaad Shudh Chakki Atta", hindiName: "आशीर्वाद आटा", category: "Staples", price: 245, unit: "bag (5kg)", stock: 30, aliases: ["atta", "aata", "wheat flour", "flour", "aashirvaad"] },
    { name: "Tata Salt Vacuum Evaporated", hindiName: "टाटा नमक", category: "Staples", price: 28, unit: "packet (1kg)", stock: 80, aliases: ["salt", "namak", "tata salt"] },
    { name: "Fortune Sunlite Refined Sunflower Oil", hindiName: "फॉर्च्यून तेल", category: "Oils", price: 145, unit: "pouch (1L)", stock: 35, aliases: ["oil", "tel", "refined oil", "sunflower oil", "fortune"] },
    { name: "Madhur Pure & Hygienic Sugar", hindiName: "चीनी", category: "Staples", price: 48, unit: "packet (1kg)", stock: 65, aliases: ["sugar", "chini", "cheeni", "shakkar"] },
    { name: "Amul Butter", hindiName: "अमूल मक्खन", category: "Dairy", price: 56, unit: "pack (100g)", stock: 40, aliases: ["butter", "makhan", "makkhan"] },
    { name: "Tata Tea Premium", hindiName: "टाटा चाय", category: "Beverages", price: 140, unit: "pack (250g)", stock: 50, aliases: ["tea", "chai", "patti", "tata tea"] },
    { name: "Parle-G Gold Biscuits", hindiName: "पारले-जी", category: "Snacks", price: 10, unit: "pack (100g)", stock: 95, aliases: ["biscuit", "parle", "parle g"] },
    { name: "Amul Masti Dahi", hindiName: "दही", category: "Dairy", price: 35, unit: "cup (400g)", stock: 25, aliases: ["dahi", "curd", "yogurt"] },
];

async function ensureCatalogSeeded() {
    const count = await StoreProduct.countDocuments();
    if (count === 0) {
        await StoreProduct.insertMany(INITIAL_PRODUCTS);
        console.log("🛒 [Store Operator] Seeded initial Kirana catalog into MongoDB");
    }
}

// 4. Tools Definition
const tools = [
    {
        type: "function",
        function: {
            name: "search_product",
            description: "Search MongoDB catalog by product name, category, or colloquial alias (e.g. 'maggi', 'atta', 'milk', 'sugar').",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_order",
            description: "Atomically decrements stock and creates confirmed order with real prices.",
            parameters: {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "string" },
                                quantity: { type: "number" }
                            },
                            required: ["productId", "quantity"]
                        }
                    },
                    customerName: { type: "string" },
                    customerPhone: { type: "string" }
                },
                required: ["items"]
            }
        }
    }
];

// Tool Executors
async function executeTool(name, args, customerInfo) {
    if (name === "search_product") {
        const regex = new RegExp(args.query.trim(), "i");
        const products = await StoreProduct.find({
            $or: [{ name: regex }, { aliases: regex }, { category: regex }, { hindiName: regex }]
        }).limit(5);

        return products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            hindiName: p.hindiName,
            price: p.price,
            unit: p.unit,
            stock: p.stock
        }));
    }

    if (name === "create_order") {
        const orderItems = [];
        let grandTotal = 0;

        for (const item of args.items) {
            // Atomic stock decrement with concurrency safety
            const product = await StoreProduct.findOneAndUpdate(
                { _id: item.productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (!product) {
                const current = await StoreProduct.findById(item.productId);
                return {
                    success: false,
                    error: `Insufficient stock for ${current?.name || "item"}. Available: ${current?.stock || 0}`
                };
            }

            const itemTotal = product.price * item.quantity;
            grandTotal += itemTotal;
            orderItems.push({
                productId: product._id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice: product.price,
                subtotal: itemTotal,
            });
        }

        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        const order = new StoreOrder({
            orderId,
            customerName: args.customerName || customerInfo.name || "Customer",
            customerPhone: args.customerPhone || customerInfo.phone || "9876543210",
            items: orderItems,
            totalAmount: grandTotal,
            status: "confirmed",
            source: "web"
        });

        await order.save();

        return {
            success: true,
            orderId,
            items: orderItems,
            totalAmount: grandTotal,
            message: "Order placed and stock reserved successfully"
        };
    }

    return { error: "Unknown tool" };
}

// 5. Main Processing Function
export async function processStoreOperatorMessage({ text, senderId, senderName, senderPhone }) {
    await ensureCatalogSeeded();

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return {
            success: false,
            reply: "Store Bot configuration error: GROQ_API_KEY missing in .env"
        };
    }

    const messages = [
        {
            role: "system",
            content: `You are the autonomous AI Store Operator for a neighborhood Kirana store.
Always use search_product to look up items and prices from MongoDB.
When customer specifies quantities, call create_order to atomically reserve stock and get the bill.
Respond in warm, friendly Hindi/Hinglish/English with the itemized bill, total amount, and Order ID.
Never invent prices or products.`
        },
        {
            role: "user",
            content: `Customer Name: ${senderName || "Customer"}\nMessage: ${text}`
        }
    ];

    try {
        // Turn 1: Groq decides which tool to call
        let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                messages,
                tools,
                tool_choice: "auto",
                temperature: 0.1
            })
        });

        let data = await response.json();
        let message = data.choices[0].message;

        // Tool execution loop (up to 3 turns)
        let loops = 0;
        while (message.tool_calls && loops < 3) {
            loops++;
            messages.push(message);

            for (const toolCall of message.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                const result = await executeTool(toolCall.function.name, args, { name: senderName, phone: senderPhone });

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: JSON.stringify(result)
                });
            }

            // Follow-up turn
            response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-120b",
                    messages,
                    tools,
                    tool_choice: "auto",
                    temperature: 0.1
                })
            });

            data = await response.json();
            message = data.choices[0].message;
        }

        return {
            success: true,
            reply: message.content || "Aapka order receive ho gaya hai!"
        };
    } catch (err) {
        console.error("Groq Operator execution error:", err);
        return {
            success: false,
            reply: "Bhaiya abhi network me thoda issue hai, kripya 1 minute baad dobara bhejein."
        };
    }
}