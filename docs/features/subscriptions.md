# Subscriptions

## Overview

FlowForge uses Polar.sh for subscription management. Users who have not subscribed to the Pro plan are restricted from creating workflows and credentials. All other features (viewing, executing existing workflows, reading execution history) are available for free.

---

## Subscription Model

| Feature | Free | Pro |
|---|---|---|
| Sign in + view dashboard | ✅ | ✅ |
| View existing workflows | ✅ | ✅ |
| Open workflow editor | ✅ | ✅ |
| Execute workflows | ✅ | ✅ |
| View execution history | ✅ | ✅ |
| Create new workflow | ❌ | ✅ |
| Create credentials | ❌ | ✅ |
| Update credentials | ❌ | ✅ |

---

## Polar.sh Integration

### Configuration (`lib/polar.ts`)
```ts
export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'sandbox',  // Change to 'production' for live billing
});
```

### better-auth Plugin (`lib/auth.ts`)
```ts
polar({
  client: polarClient,
  createCustomerOnSignUp: true,  // Creates Polar customer on registration
  use: [
    checkout({
      products: [
        { productId: "b9f135a2-99b8-43d0-a0f5-d9bb5a7bf44d", slug: "pro" }
      ],
      successUrl: getPolarSuccessUrl(),  // POLAR_SUCCESS_URL env var (default: /workflows)
      authenticatedUsersOnly: true,
    }),
    portal(),   // Customer portal access
    usage(),    // Usage tracking
  ],
})
```

---

## Subscription Checking

### `premiumProcedure` (`trpc/init.ts`)
All Pro-gated tRPC procedures extend `premiumProcedure`:

```ts
export const premiumProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const customer = await polarClient.customers.getStateExternal({
    externalId: ctx.auth.user.id,  // User ID as external customer ID
  });

  if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
  }

  return next({ ctx: { ...ctx, customer } });
});
```

This check runs on every Pro-gated procedure call. It queries Polar.sh's API with the user's ID.

### Client-side Check (`features/subscriptions/hooks/use-subscription.ts`)
```ts
export const useHasActiveSubscription = () => {
  const { data } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await authClient.customer.state();
      return data;
    },
  });

  return {
    hasActiveSubscription: data?.activeSubscriptions?.length > 0,
    subscription: data?.activeSubscriptions?.[0],
    isLoading,
  };
};
```

Used in the sidebar to show/hide the "Upgrade to Pro" button.

---

## User Flows

### Upgrading to Pro

1. User clicks "Upgrade to Pro" in the sidebar (shown only if not subscribed).
2. `authClient.checkout({ slug: "pro" })` is called.
3. User is redirected to the Polar.sh checkout page.
4. On successful payment, user is redirected to `POLAR_SUCCESS_URL` (default: `/workflows`).
5. On next Pro-gated action, `premiumProcedure` sees the active subscription.

### Accessing Billing Portal

1. User clicks "Billing" in the sidebar.
2. `authClient.customer.portal()` is called.
3. User is redirected to the Polar.sh customer portal.
4. User can manage their subscription, view invoices, or cancel.

### Free User Hitting a Gate

1. User (free) navigates to "New Workflow".
2. Calls `trpc.workflows.create.mutate()`.
3. Server returns `TRPCError { code: "FORBIDDEN", message: "Active subscription required" }`.
4. UI shows an error or upgrade prompt.

---

## Sidebar UI (`components/app-sidebar.tsx`)

```tsx
const { hasActiveSubscription, isLoading } = useHasActiveSubscription();
const showUpgrade = isClient && !hasActiveSubscription && !isLoading;

// Rendered in sidebar footer:
{showUpgrade && (
  <SidebarMenuButton onClick={() => authClient.checkout({ slug: "pro" })}>
    <StarIcon /> Upgrade to Pro
  </SidebarMenuButton>
)}

<SidebarMenuButton onClick={() => authClient.customer.portal()}>
  <CreditCardIcon /> Billing
</SidebarMenuButton>
```

---

## Environment Configuration

| Variable | Description |
|---|---|
| `POLAR_ACCESS_TOKEN` | API token from Polar.sh dashboard |
| `POLAR_SUCCESS_URL` | Redirect path after successful checkout (default: `/workflows`) |

### Switching to Production

1. Change `server: 'sandbox'` to `server: 'production'` in `lib/polar.ts`.
2. Generate a production access token in the Polar.sh production dashboard.
3. Create the Pro product in the production dashboard.
4. Update the product ID in `lib/auth.ts` (`productId` field).
5. Update `POLAR_ACCESS_TOKEN` in the production environment.

---

## Customer Creation on Sign-up

`createCustomerOnSignUp: true` in the Polar plugin config means every new user registration automatically creates a Polar customer with the user's `id` as the external ID (`externalId`). This external ID is what `premiumProcedure` uses to look up subscription state.

If customer creation fails on sign-up (e.g., Polar API is down), the user account is still created but subscription lookups will fail until the customer is reconciled manually in the Polar dashboard.
