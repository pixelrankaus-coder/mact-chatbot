"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export default function WidgetTestPage() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Sample website content */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">
              MACt GFRC Products
            </h1>
            <nav className="flex gap-6 text-sm">
              <a href="#" className="text-slate-600 hover:text-slate-900">
                Products
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900">
                Gallery
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900">
                About
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero Section */}
        <section className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-slate-900">
            Premium GFRC Concrete Solutions
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Glass Fiber Reinforced Concrete panels for architectural excellence.
            Custom designs, superior durability, and stunning aesthetics.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
              View Products
            </button>
            <button className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
              Get Quote
            </button>
          </div>
        </section>

        {/* Products Grid */}
        <section className="mb-16">
          <h3 className="mb-8 text-2xl font-bold text-slate-900">
            Featured Products
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Architectural Panels",
                desc: "Custom facade panels for commercial buildings",
                price: "$45/sq ft",
              },
              {
                name: "Decorative Screens",
                desc: "Intricate patterns for interior design",
                price: "$65/sq ft",
              },
              {
                name: "Outdoor Furniture",
                desc: "Weather-resistant GFRC planters and benches",
                price: "From $350",
              },
            ].map((product, i) => (
              <div
                key={i}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 h-40 rounded-lg bg-slate-200" />
                <h4 className="mb-2 font-semibold text-slate-900">
                  {product.name}
                </h4>
                <p className="mb-3 text-sm text-slate-600">{product.desc}</p>
                <p className="font-medium text-blue-600">{product.price}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h3 className="mb-4 text-xl font-bold text-slate-900">
            Widget Test Info
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong>Status:</strong>{" "}
              <span
                className={
                  widgetLoaded ? "text-green-600" : "text-yellow-600"
                }
              >
                {widgetLoaded ? "Widget Loaded" : "Loading Widget..."}
              </span>
            </p>
            <p>
              <strong>Test the widget:</strong> Click the chat bubble in the
              bottom-right corner to open the chat.
            </p>
            <p>
              <strong>Try these questions:</strong>
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>What GFRC products do you offer?</li>
              <li>How much do panels cost?</li>
              <li>What is the lead time for custom orders?</li>
              <li>Do you ship to California?</li>
            </ul>
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-700">Embed Code (V2):</p>
              <code className="mt-2 block break-all rounded bg-slate-200 p-2 text-xs">
                {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/widget/chat-widget-v2.js"></script>`}
              </code>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          <p>This is a test page for the MACt Chat Widget</p>
          <p className="mt-2">
            &copy; 2024 MACt GFRC Products. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Load the chat widget V2 */}
      <Script
        src="/widget/chat-widget-v2.js"
        strategy="afterInteractive"
        onLoad={() => setWidgetLoaded(true)}
      />
    </div>
  );
}
