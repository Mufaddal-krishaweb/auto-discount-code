import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Handle order creation webhooks
    if (topic === "orders/create") {
        const discountCodes = payload.discount_codes || [];

        if (discountCodes.length === 0) {
            return new Response("No discount codes used", { status: 200 });
        }

        const { admin } = await authenticate.admin(request);

        // Process each discount code
        for (const discountCode of discountCodes) {
            try {
                // Query to get the discount and its metafields
                const discountQuery = `#graphql
          query getDiscount($code: String!) {
            codeDiscountNodeByCode(code: $code) {
              id
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
              metafields(
                first: 4,
                namespace: "progressive_discount"
              ) {
                nodes {
                  key
                  value
                }
              }
            }
          }
        `;

                const response = await admin.graphql(discountQuery, {
                    variables: { code: discountCode.code },
                });

                const data = await response.json();
                const discountNode = data.data.codeDiscountNodeByCode;

                if (!discountNode) continue;

                // Extract metafield values
                const metafields = discountNode.metafields.nodes.reduce((acc, mf) => {
                    acc[mf.key] = mf.value;
                    return acc;
                }, {});

                // Skip if this isn't a progressive discount
                if (!metafields.increment_value) continue;

                const currentPercentage = discountNode.codeDiscount.customerGets.value.percentage * 100;
                const incrementBy = parseFloat(metafields.increment_value);
                const endingPercentage = parseFloat(metafields.ending_percentage);

                // Calculate new percentage
                let newPercentage = currentPercentage + incrementBy;
                if (newPercentage > endingPercentage) {
                    newPercentage = endingPercentage;
                }

                // Skip update if no change needed
                if (newPercentage === currentPercentage) continue;

                // Update discount percentage
                const updateMutation = `#graphql
          mutation discountCodeBasicUpdate($id: ID!, $input: DiscountCodeBasicInput!) {
            discountCodeBasicUpdate(id: $id, codeDiscount: $input) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

                const updateResponse = await admin.graphql(updateMutation, {
                    variables: {
                        id: discountNode.id,
                        input: {
                            customerGets: {
                                value: {
                                    percentage: newPercentage / 100
                                },
                                items: {
                                    all: true
                                }
                            }
                        }
                    },
                });

                const updateData = await updateResponse.json();

                if (updateData.data?.discountCodeBasicUpdate?.userErrors?.length > 0) {
                    console.error('Failed to update discount:', updateData.data.discountCodeBasicUpdate.userErrors);
                    continue;
                }

                console.log(`Successfully updated discount ${discountCode.code} from ${currentPercentage}% to ${newPercentage}%`);
            } catch (error) {
                console.error(`Error processing discount code ${discountCode.code}:`, error);
            }
        }
    }

    return new Response("Webhook processed", { status: 200 });
};