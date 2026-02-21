// MACt Outreach - Template Rendering Utilities

export const TEMPLATE_VARIABLES = [
  { key: "first_name", description: "Customer first name", example: "Chad" },
  { key: "last_name", description: "Customer last name", example: "Buckley" },
  {
    key: "company",
    description: "Company name",
    example: "Atlas Waterscapes",
  },
  {
    key: "last_product",
    description: "Last purchased product",
    example: "MACt Rock Carve",
  },
  {
    key: "last_order_date",
    description: "Date of last order",
    example: "13 April 2023",
  },
  {
    key: "days_since_order",
    description: "Days since last order",
    example: "650",
  },
  {
    key: "total_spent",
    description: "Total amount spent",
    example: "$36,768.59",
  },
  { key: "order_count", description: "Number of orders", example: "6" },
  {
    key: "coupon_code",
    description: "Coupon/discount code",
    example: "THANKYOU10",
  },
  {
    key: "product_mentioned",
    description: "Product discussed in chat",
    example: "MACt Rock Carve",
  },
  {
    key: "chat_summary",
    description: "Brief summary of chat conversation",
    example: "You asked about our Rock Carve product and pricing",
  },
  {
    key: "discount_code",
    description: "Chat follow-up discount code",
    example: "CHAT10",
  },
  {
    key: "product_url",
    description: "URL to the discussed product",
    example: "https://mact.au/product/rock-carve/",
  },
];

// Fallback values for empty/missing personalization data
const FALLBACK_VALUES: Record<string, string> = {
  first_name: "there",
  last_name: "",
  company: "your company",
  last_product: "our products",
  last_order_date: "a while back",
  days_since_order: "",
  total_spent: "",
  order_count: "",
  coupon_code: "THANKYOU10",
  product_mentioned: "our products",
  chat_summary: "your recent conversation with us",
  discount_code: "CHAT10",
  product_url: "https://mact.au/shop/",
};

export function renderTemplate(
  template: { subject: string; body: string },
  data: Record<string, unknown>
): { subject: string; body: string } {
  const render = (text: string) => {
    // Match {{variable}} with optional whitespace: {{ variable }}, {{variable}}, {{ variable}}, etc.
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      const value = data[key];

      // Use fallback if value is missing, null, or empty string
      if (value === undefined || value === null || value === "") {
        const fallback = FALLBACK_VALUES[key];
        return fallback !== undefined ? fallback : match;
      }

      // Format special values
      if (key === "total_spent" && typeof value === "number") {
        return new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
        }).format(value);
      }
      if (key === "last_order_date" && value) {
        return new Date(value as string).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
      return String(value);
    });
  };

  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

export function extractVariables(text: string): string[] {
  // Match {{variable}} with optional whitespace
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

export function getSampleData(): Record<string, unknown> {
  return {
    first_name: "Chad",
    last_name: "Buckley",
    company: "Atlas Waterscapes",
    last_product: "MACt Rock Carve",
    last_order_date: "2023-04-13",
    days_since_order: 650,
    total_spent: 36768.59,
    order_count: 6,
    coupon_code: "THANKYOU10",
    product_mentioned: "MACt Rock Carve",
    chat_summary: "You asked about our Rock Carve product and pricing",
    discount_code: "CHAT10",
    product_url: "https://mact.au/product/rock-carve/",
  };
}

export function validateTemplate(template: {
  name: string;
  subject: string;
  body: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.name || template.name.trim().length === 0) {
    errors.push("Template name is required");
  }

  if (!template.subject || template.subject.trim().length === 0) {
    errors.push("Subject line is required");
  }

  if (!template.body || template.body.trim().length === 0) {
    errors.push("Email body is required");
  }

  // Check for unknown variables
  const allText = `${template.subject} ${template.body}`;
  const usedVariables = extractVariables(allText);
  const knownVariables = TEMPLATE_VARIABLES.map((v) => v.key);

  usedVariables.forEach((v) => {
    if (!knownVariables.includes(v)) {
      errors.push(`Unknown variable: {{${v}}}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
