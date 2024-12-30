import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  TextField,
  Banner,
  Checkbox,
  Select,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const query = `#graphql
    query {
      customers(first: 50) {
        edges {
          node {
            id
            displayName
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const data = await response.json();
    return { customers: data.data.customers.edges.map((edge) => edge.node) };
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { customers: [] };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const discountData = {
    discountTitle: formData.get("title"),
    discountCode: formData.get("code"),
    discountId: "",
    customerGid: formData.get("customerId"),
    codeUsage: 0,
    discountPercentage: parseFloat(formData.get("percentage")),
    startingPercentage: parseFloat(formData.get("percentage")),
    incrementBy: parseFloat(formData.get("incrementBy")),
    endingPercentage: parseFloat(formData.get("endingPercentage")),
    endingDate: new Date(formData.get("endDate")),
  };

  const mutation = `#graphql
      mutation CreateBasicDiscountCode($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
                startsAt
                endsAt
              }
            }
          }
          userErrors {
            field
            code
            message
          }
        }
      }
    `;

  try {
    const percentage = parseFloat(formData.get("percentage")) / 100;

    const discountInput = {
      title: formData.get("title"),
      code: formData.get("code"),
      startsAt: formData.get("startDate"),
      endsAt: formData.get("endDate"),
      customerSelection: {
        customers: {
          add: [formData.get("customerId")],
        },
      },
      customerGets: {
        value: {
          percentage,
        },
        items: {
          all: true,
        },
      },
      appliesOncePerCustomer: false,
    };

    const response = await admin.graphql(mutation, {
      variables: { input: discountInput },
    });

    const responseJson = await response.json();
    console.log("Shopify GraphQL Response:", responseJson);

    if (responseJson.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
      return { error: responseJson.data.discountCodeBasicCreate.userErrors[0].message };
    }

    const codes =
      responseJson.data?.discountCodeBasicCreate?.codeDiscountNode?.codeDiscount?.codes?.nodes || [];
    const discountId = responseJson.data?.discountCodeBasicCreate?.codeDiscountNode?.id;

    // Insert into MySQL database if the discount code was successfully generated
    if (codes.length > 0 && discountId) {
      discountData.discountCode = codes[0].code;
      discountData.discountId = discountId;

      await prisma.discountCode.create({
        data: discountData,
      });
    }

    return {
      success: true,
      discount: {
        ...responseJson.data.discountCodeBasicCreate.codeDiscountNode.codeDiscount,
        id: discountId,
        codes,
      },
    };
  } catch (error) {
    console.error("GraphQL Mutation Error:", error);
    return { error: "Failed to create discount code" };
  } finally {
    await prisma.$disconnect();
  }
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const { customers } = useLoaderData();

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [incrementBy, setIncrementBy] = useState("5");
  const [endingPercentage, setEndingPercentage] = useState("20");
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [endDate, setEndDate] = useState("2027-12-31T23:59:59Z");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (autoGenerate) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const randomCode = Array(8)
        .fill(0)
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join("");
      setCode(randomCode);
    }
  }, [autoGenerate]);

  useEffect(() => {
    if (fetcher.data?.error) {
      setError(fetcher.data.error);
      shopify.toast.show(fetcher.data.error, { isError: true });
    } else if (fetcher.data?.success) {
      setError("");
      shopify.toast.show("Discount code created successfully!");
      if (autoGenerate) setCode("");
    }
  }, [fetcher.data, shopify]);

  const handleSubmit = () => {
    if (!title || !code || !percentage || !incrementBy || !endingPercentage || !customerId) {
      setError("Required fields missing");
      return;
    }

    fetcher.submit(
      { title, code, customerId, percentage, incrementBy, endingPercentage, startDate, endDate },
      { method: "POST" }
    );
  };

  return (
    <Page>
      <TitleBar title="Discount Generator" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              {error && (
                <Banner status="critical">
                  <p>{error}</p>
                </Banner>
              )}

              <BlockStack gap="300">
                <Select
                  label="Customer"
                  options={customers.map((customer) => ({
                    label: customer.displayName,
                    value: customer.id,
                  }))}
                  value={customerId}
                  onChange={setCustomerId}
                />
                <TextField
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                />

                <Checkbox
                  label="Auto-generate code"
                  checked={autoGenerate}
                  onChange={setAutoGenerate}
                />

                <TextField
                  label="Code"
                  value={code}
                  onChange={setCode}
                  disabled={autoGenerate}
                  autoComplete="off"
                />

                <TextField
                  label="Percentage"
                  value={percentage}
                  onChange={setPercentage}
                  type="number"
                  suffix="%"
                  min="0"
                  max="100"
                />

                <TextField
                  label="Increment By"
                  value={incrementBy}
                  onChange={setIncrementBy}
                  type="number"
                  suffix="%"
                  min="0"
                />

                <TextField
                  label="Ending Percentage"
                  value={endingPercentage}
                  onChange={setEndingPercentage}
                  type="number"
                  suffix="%"
                  min="0"
                />

                <TextField
                  label="Start Date"
                  value={startDate.split("T")[0]}
                  onChange={(value) => setStartDate(`${value}T00:00:00Z`)}
                  type="date"
                />

                <TextField
                  label="End Date"
                  value={endDate.split("T")[0]}
                  onChange={(value) => setEndDate(`${value}T23:59:59Z`)}
                  type="date"
                />

                <Button onClick={handleSubmit}>Create Discount</Button>
              </BlockStack>

              {fetcher.data?.success && (
                <BlockStack gap="200">
                  <p>Discount Created Successfully!</p>
                  <p>Discount Title: {fetcher.data.discount.title}</p>
                  <p>Code: {fetcher.data.discount.codes?.nodes && fetcher.data.discount.codes.nodes.length > 0
                    ? fetcher.data.discount.codes.nodes[0].code
                    : "N/A"}</p>
                  <p>Valid From: {new Date(fetcher.data.discount.startsAt).toLocaleDateString()}</p>
                  <p>Valid Until: {new Date(fetcher.data.discount.endsAt).toLocaleDateString()}</p>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
