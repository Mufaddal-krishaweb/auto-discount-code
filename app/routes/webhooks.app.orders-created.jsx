import crypto from "crypto";

export async function action({ request }) {
  const body = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");

  const calculatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (calculatedHmac !== hmac) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(body);

  if (payload.discount_applications) {
    console.log("Discount used:", payload.discount_applications);
    // Add your logic to update the database or notify the admin
  }

  return new Response("Webhook processed successfully", { status: 200 });
}
