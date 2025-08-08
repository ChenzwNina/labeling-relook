/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Define a KV namespace for storing applicant data
let kvNamespace = null;

function getCorsHeaders(origin) {
  const allowedOrigin = "https://chenzwnina.github.io"; // Change if needed
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function withCorsHeaders(response, origin) {
  const headers = new Headers(response.headers || {});
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function getTime() {
  return new Date().getTime();
}

async function handleUpload(request, origin) {
  if (request.method !== "POST") {
    return withCorsHeaders(new Response("Method Not Allowed", { status: 405 }), origin);
  }

  try {

    const { key, index, rater } = await request.json();
    console.log("log", key, index, rater);
    if (!key || !index || !rater) {
        console.warn("Missing fields:", { key, index, rater });
        return withCorsHeaders(new Response("Bad Request: Missing fields", { status: 400 }), origin);
    }

    const fullKey = `${rater}:${key}`;
    await kvNamespace.put(fullKey, JSON.stringify({ time: getTime(), index, rater }));

    return withCorsHeaders(
      new Response(JSON.stringify({ msg: "Annotation progress saved", index }), { status: 200 }),
      origin
    );
  } catch (err) {
    console.error("Upload error:", err);
    return withCorsHeaders(new Response("Bad Request", { status: 400 }), origin);
  }
}

async function handleGetCompleted(request, origin) {
  if (request.method !== "POST") {
    return withCorsHeaders(new Response("Method Not Allowed", { status: 405 }), origin);
  }

  const { key } = await request.json();
  const result = await kvNamespace.list({ prefix: `${key}:` });
  return withCorsHeaders(new Response(JSON.stringify(result.keys), { status: 200 }), origin);
}

async function handleGetComment(request, origin) {
    if (request.method !== "POST") {
      return withCorsHeaders(new Response("Method Not Allowed", { status: 405 }), origin);
    }
  
    try {
      const { key } = await request.json();
      console.log("handleGetComment received key:", key);
  
      if (!key) {
        return withCorsHeaders(new Response(JSON.stringify({ error: "Missing key" }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }), origin);
      }
  
      const value = await kvNamespace.get(key);
      console.log("Retrieved value:", value);
  
      return withCorsHeaders(new Response(value || "", { status: 200 }), origin);
    } catch (err) {
      console.error("handleGetComment error:", err);
      return withCorsHeaders(new Response(JSON.stringify({ error: "Internal Error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), origin);
    }
  }
  

  async function handlePutComment(request, origin) {
    if (request.method !== "POST") {
      return withCorsHeaders(new Response("Method Not Allowed", { status: 405 }), origin);
    }
  
    try {
      const { key, rater, value } = await request.json();
      console.log("handlePutComment payload:", { key, rater, value });
  
      if (!key || !rater || !value) {
        console.warn("Missing fields in /put:", { key, rater, value });
        return withCorsHeaders(new Response("Bad Request: Missing fields", { status: 400 }), origin);
      }
  
      await kvNamespace.put(key, JSON.stringify({ time: getTime(), rater, value }));
  
      return withCorsHeaders(
        new Response(JSON.stringify({ msg: "Annotation saved", key }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }),
        origin
      );
    } catch (err) {
      console.error("handlePutComment error:", err);
      return withCorsHeaders(new Response(JSON.stringify({ error: "Internal Error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), origin);
    }
  }
  

export default {
  async fetch(request, env) {
    console.log("env keys:", Object.keys(env));

    const origin = request.headers.get("Origin") || "*";

    // Set the global KV binding
    kvNamespace = env["data-relook"];

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin)
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case "/upload":
          return await handleUpload(request, origin);
        case "/getCompleted":
          return await handleGetCompleted(request, origin);
        case "/get":
          return await handleGetComment(request, origin);
        case "/put":
          return await handlePutComment(request, origin);
        default:
          return withCorsHeaders(new Response("Not Found", { status: 404 }), origin);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      return withCorsHeaders(new Response(JSON.stringify({ error: "Internal Error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), origin);
      
    }
  }
};