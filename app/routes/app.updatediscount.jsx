import { useFetcher, useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Button, Select, Banner } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    try {
        // Fetch Shopify discounts
        const response = await admin.graphql(
            `query GetDiscounts {
                codeDiscountNodes(first: 100) {
                    edges {
                        node {
                            id
                            codeDiscount {
                                ... on DiscountCodeBasic {
                                    title
                                    codes(first: 1) {
                                        edges {
                                            node {
                                                code
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`
        );

        const result = await response.json();
        const shopifyDiscounts = result.data.codeDiscountNodes.edges;

        // Fetch database discounts
        const dbDiscounts = await prisma.discountCode.findMany({
            select: {
                id: true,
                discountTitle: true,
                discountCode: true,
                discountId: true,
                discountPercentage: true,
                endingPercentage: true,
            },
            where: {
                endingDate: {
                    gt: new Date(), // Only get active discounts
                },
            },
        });

        // Match discounts that exist in both systems
        const matchedDiscounts = dbDiscounts.filter(dbDiscount =>
            shopifyDiscounts.some(shopifyDiscount =>
                shopifyDiscount.node.id === dbDiscount.discountId
            )
        );

        // Format for dropdown
        const dropdownOptions = matchedDiscounts.map(discount => ({
            label: `${discount.discountTitle} (${discount.discountCode}) - Current: ${discount.discountPercentage}%`,
            value: discount.id,
            disabled: discount.discountPercentage >= discount.endingPercentage
        }));

        return { discounts: dropdownOptions };
    } catch (error) {
        console.error("Loader Error:", error);
        return { error: "Failed to load discounts", discounts: [] };
    } finally {
        await prisma.$disconnect();
    }
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const discountId = formData.get("discountId");

    try {
        const discount = await prisma.discountCode.findUnique({
            where: { id: discountId },
        });

        if (!discount) {
            return { error: "Discount not found" };
        }

        const updatedPercentage = discount.discountPercentage + discount.incrementBy;

        if (updatedPercentage > discount.endingPercentage) {
            return { error: "Maximum percentage reached" };
        }

        // Update Shopify using GraphQL mutation
        const shopifyResponse = await admin.graphql(
            `mutation UpdateDiscountCodePercentage($id: ID!, $percentage: Float!) {
                discountCodeBasicUpdate(
                    id: $id,
                    basicCodeDiscount: {
                        customerGets: {
                            value: {
                                percentage: $percentage
                            }
                        }
                    }
                ) {
                    codeDiscountNode {
                        codeDiscount {
                            ... on DiscountCodeBasic {
                                title
                                customerGets {
                                    value {
                                        ... on DiscountPercentage {
                                            percentage
                                        }
                                    }
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        code
                        message
                    }
                }
            }`,
            {
                variables: {
                    id: discount.discountId,
                    percentage: updatedPercentage / 100,
                },
            }
        );

        const result = await shopifyResponse.json();

        if (result.data?.discountCodeBasicUpdate?.userErrors?.length > 0) {
            const errors = result.data.discountCodeBasicUpdate.userErrors
                .map(error => error.message)
                .join(", ");
            return { error: `Shopify update failed: ${errors}` };
        }

        // Update local database
        await prisma.discountCode.update({
            where: { id: discount.id },
            data: { discountPercentage: updatedPercentage },
        });

        return {
            success: true,
            newPercentage: updatedPercentage,
            title: discount.discountTitle
        };
    } catch (error) {
        console.error("Update Error:", error);
        return { error: "Failed to update discount" };
    } finally {
        await prisma.$disconnect();
    }
};

export default function UpdateDiscount() {
    const fetcher = useFetcher();
    const { discounts, error: loaderError } = useLoaderData();
    const [selectedDiscountId, setSelectedDiscountId] = useState("");
    const [error, setError] = useState(loaderError || "");
    const [successMessage, setSuccessMessage] = useState("");

    const handleUpdate = () => {
        if (!selectedDiscountId) {
            setError("Please select a discount to update.");
            return;
        }

        fetcher.submit(
            { discountId: selectedDiscountId },
            { method: "POST" }
        );
    };

    useEffect(() => {
        if (fetcher.data?.error) {
            setError(fetcher.data.error);
            setSuccessMessage("");
        } else if (fetcher.data?.success) {
            setError("");
            setSuccessMessage(
                `Successfully updated discount "${fetcher.data.title}" to ${fetcher.data.newPercentage}%`
            );
        }
    }, [fetcher.data]);

    return (
        <Page title="Update Discount">
            <Layout>
                <Layout.Section>
                    <Card sectioned>
                        {error && (
                            <Banner status="critical" title="Error" onDismiss={() => setError("")}>
                                {error}
                            </Banner>
                        )}
                        {successMessage && (
                            <Banner status="success" title="Success" onDismiss={() => setSuccessMessage("")}>
                                {successMessage}
                            </Banner>
                        )}

                        <Select
                            label="Select Discount"
                            options={discounts}
                            value={selectedDiscountId}
                            onChange={setSelectedDiscountId}
                            disabled={discounts.length === 0}
                            helpText={
                                discounts.length === 0
                                    ? "No eligible discounts found"
                                    : "Select a discount to update its percentage"
                            }
                        />

                        <div style={{ marginTop: "1rem" }}>
                            <Button
                                onClick={handleUpdate}
                                primary
                                loading={fetcher.state === "submitting"}
                                disabled={!selectedDiscountId || discounts.length === 0}
                            >
                                Update Discount
                            </Button>
                        </div>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}