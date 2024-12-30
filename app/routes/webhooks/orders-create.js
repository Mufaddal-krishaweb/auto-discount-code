import { authenticate } from "../../shopify.server";
import prisma from "../../db.server";

export const action = async ({ request }) => {
    const body = await request.text();
    const verified = await authenticate.webhook(request);

    if (!verified) {
        return new Response("Webhook verification failed", { status: 401 });
    }

    const orderData = JSON.parse(body);
    const { discount_codes: discountCodes, id: orderId, customer } = orderData;

    if (discountCodes && discountCodes.length > 0) {
        const discountCode = discountCodes[0].code;

        try {
            await prisma.discountCode.updateMany({
                where: { discountCode },
                data: {
                    codeUsage: {
                        increment: 1,
                    },
                    appliedOrders: {
                        push: {
                            orderId: orderId.toString(),
                            customerId: customer?.id?.toString(),
                        },
                    },
                },
            });
        } catch (error) {
            console.error("Error updating discount code usage:", error);
            return new Response("Error processing webhook", { status: 500 });
        }
    }

    return new Response("Webhook processed", { status: 200 });
};
