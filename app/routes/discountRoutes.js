import { authenticate } from "../shopify.server";

export const discountLoader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const discountAction = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    // Extract form data
    const customerId = formData.get("customerId");
    const discountTitle = formData.get("discountTitle");
    const discountCode = formData.get("discountCode");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const startingPercentage = parseFloat(formData.get("startingPercentage")) || 10;
    const incrementBy = parseFloat(formData.get("incrementBy")) || 0;
    const endingPercentage = parseFloat(formData.get("endingPercentage")) || startingPercentage;

    // Validation
    if (!customerId || !discountCode) {
        return { error: "Customer ID and discount code are required" };
    }

    try {
        // Create Shopify discount
        const response = await createShopifyDiscount({
            admin,
            discountTitle,
            discountCode,
            customerId,
            startDate,
            endDate,
            startingPercentage
        });

        if (response.error) {
            return response;
        }

        // Store in database
        await DiscountModel.createDiscount({
            discountTitle,
            discountCode,
            customerGid: customerId,
            startingPercentage,
            incrementBy,
            endingPercentage,
            endingDate: new Date(endDate)
        });

        return {
            success: true,
            discount: {
                title: response.discount.title,
                code: response.discount.code,
                startsAt: response.discount.startsAt,
                endsAt: response.discount.endsAt,
                startingPercentage,
                incrementBy,
                endingPercentage
            }
        };
    } catch (error) {
        console.error('Error:', error);
        return { error: "Failed to create discount code" };
    }
};
