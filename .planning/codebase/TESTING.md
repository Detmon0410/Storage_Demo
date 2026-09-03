# Testing Patterns

**Analysis Date:** 2026-09-03

## Test Framework

**Status:** No testing framework currently configured

**Runner:**
- None detected - TypeScript compilation (`tsc`) enforces static type safety instead
- Config: Backend uses `tsconfig.json`, Frontend uses `tsconfig.app.json`

**Assertion Library:**
- Not applicable - no tests present

**Run Commands:**
```bash
# Backend - type check only (no test runner)
npm run build                 # Compiles TypeScript with type checking

# Frontend - type check only (no test runner)
npm run build                 # Compiles TypeScript with type checking

# Linting available (frontend only)
npm run lint                  # ESLint check for frontend

# Running application (development)
npm run dev:be               # Start backend server
npm run dev:fe               # Start frontend dev server
npm run dev                  # Run both parallel
```

## Test File Organization

**Current State:**
- No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files found in codebase
- Testing not part of development workflow

**If tests were to be added:**

**Recommended Location:**
- Backend: `apps/backend/src/__tests__/` or `apps/backend/src/[module]/__tests__/`
- Frontend: `apps/frontend/src/__tests__/` or co-located as `ComponentName.test.tsx`

**Naming:**
- Backend: `[module].test.ts` (e.g., `product.controller.test.ts`)
- Frontend: `[component].test.tsx` (e.g., `Button.test.tsx`, `useResource.test.ts`)

## Test Structure

**If using Vitest or Jest, recommended patterns based on codebase:**

### Backend Controller Testing
```typescript
// apps/backend/src/__tests__/controllers/product.controller.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { productApi } from '../resources';
import { listProducts, createProduct } from '../../controllers/product.controller';

describe('Product Controller', () => {
  describe('listProducts', () => {
    it('should return all products', async () => {
      const req = {} as Request;
      const res = { json: vi.fn() } as unknown as Response;
      
      await listProducts(req, res);
      
      expect(res.json).toHaveBeenCalled();
    });
  });
});
```

### Frontend Component Testing
```typescript
// apps/frontend/src/components/ui/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  
  it('applies variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-rose-600');
  });
});
```

### Hook Testing
```typescript
// apps/frontend/src/hooks/useResource.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResource } from './useResource';

describe('useResource', () => {
  it('loads data on mount', async () => {
    const mockApi = {
      list: vi.fn().mockResolvedValue([{ id: 1, name: 'Product 1' }]),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    
    const { result } = renderHook(() => useResource(mockApi, (r) => r.id));
    
    await act(async () => {
      // Wait for effect
    });
    
    expect(mockApi.list).toHaveBeenCalled();
  });
});
```

## Patterns for Testing This Codebase

**Backend (Controllers):**
- Test controller functions separately from models
- Mock the `ProductModel` to isolate controller logic
- Verify correct HTTP status codes returned
- Validate error handling with `HttpError` and Prisma errors

**Backend (Models):**
- Integration tests against test database (using Prisma)
- Or mock Prisma client for unit tests
- Test query building and data transformation

**Frontend (Components):**
- Test rendering with provided props
- Test event handlers (onClick, onChange)
- Test variant/size props apply correct classes (Tailwind)
- Test loading/disabled states

**Frontend (Hooks):**
- Test state management (rows, loading, error, saving)
- Test API calls through mocked `createResourceApi`
- Test error handling for API failures
- Test side effects (useEffect, useCallback)

**Frontend (API Client):**
- Mock `fetch` for API calls
- Test request formatting (headers, body)
- Test response parsing
- Test error mapping to `ApiError`

## Mocking

**Framework to use:** Vitest with `vi.mock()` or `vi.fn()`

**Patterns:**

### Mocking Express Request/Response (Backend)
```typescript
import { vi } from 'vitest';

const mockReq = {
  params: { id: '1' },
  body: { name: 'Product' },
} as unknown as Request;

const mockRes = {
  json: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  end: vi.fn(),
} as unknown as Response;
```

### Mocking Prisma Client (Backend)
```typescript
import { vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));
```

### Mocking API Calls (Frontend)
```typescript
const mockApi = {
  list: vi.fn().mockResolvedValue([...]),
  get: vi.fn().mockResolvedValue(...),
  create: vi.fn().mockResolvedValue(...),
  update: vi.fn().mockResolvedValue(...),
  remove: vi.fn().mockResolvedValue(...),
};

// Use in tests:
const { result } = renderHook(() => useResource(mockApi, (r) => r.id));
```

### Mocking i18n (Frontend)
```typescript
vi.mock('../i18n', () => ({
  default: {
    t: (key: string) => key, // Return key as translation
    language: 'en',
  },
}));
```

**What to Mock:**
- External API calls (use mockResolvedValue, mockResolvedValueOnce)
- Database queries (Prisma client)
- i18n for consistent translations in tests
- Date/time if time-dependent
- localStorage/sessionStorage if needed

**What NOT to Mock:**
- TypeScript types and interfaces
- Utility functions (formatCurrency, formatNumber)
- Helper functions in same module
- Component rendering libraries (use @testing-library/react)

## Fixtures and Factories

**Test Data Pattern (if needed):**

### Backend Fixtures
```typescript
// apps/backend/src/__tests__/fixtures/product.ts
export const mockProduct = {
  productId: 1,
  productCode: 'PROD-001',
  productName: 'Test Product',
  categoryId: 1,
  supplierId: 1,
  unit: 'bottle',
  stockQty: 100,
  minStock: 10,
  unitPrice: 10.5,
};

export const mockProductInput = {
  productCode: 'PROD-001',
  productName: 'Test Product',
  categoryId: 1,
  supplierId: 1,
  unit: 'bottle',
  unitPrice: 10.5,
};
```

### Frontend Fixtures
```typescript
// apps/frontend/src/__tests__/fixtures/product.ts
export const mockProduct: Product = {
  productId: 1,
  productCode: 'PROD-001',
  productName: 'Test Product',
  categoryId: 1,
  category: { categoryId: 1, categoryName: 'Spirits' },
  supplierId: 1,
  supplier: { supplierId: 1, supplierName: 'Supplier A' },
  unit: 'bottle',
  stockQty: 100,
};
```

**Location:**
- `apps/backend/src/__tests__/fixtures/` for backend
- `apps/frontend/src/__tests__/fixtures/` for frontend
- Or co-located with test files for smaller suites

## Coverage

**Requirements:** None enforced currently

**If configured:**
- Recommended minimum: 70% for critical paths (API endpoints, hooks)
- Controllers and models: High priority
- Presentational components: Lower priority
- Utilities: High priority if shared

**View Coverage:**
```bash
# With Vitest
vitest run --coverage

# Coverage output
# statements: 70%
# branches: 65%
# functions: 70%
# lines: 70%
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, controllers, utilities
- **Approach:**
  - Test controller logic with mocked models
  - Test utility functions with various inputs
  - Test hooks with mocked API
  - Isolated, no external dependencies

**Integration Tests:**
- **Scope:** Models with test database, API routes with mocked models
- **Approach:**
  - Spin up test database (Prisma with test DB)
  - Test full request/response cycle
  - Verify error handling end-to-end
  - Example: POST /api/products returns 201 and created product

**E2E Tests:**
- **Framework:** Not currently used
- **If implemented:** Could use Playwright or Cypress
  - Test user workflows (create product, view list, edit, delete)
  - Test UI interactions (form submission, validation, error states)

## Common Patterns

**Async Testing:**
```typescript
// Vitest pattern
describe('async operations', () => {
  it('handles async data loading', async () => {
    const mockApi = { list: vi.fn().mockResolvedValue([...]) };
    const { result } = renderHook(() => useResource(mockApi, getId));
    
    await act(async () => {
      // Wait for promise resolution
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.rows).toBeDefined();
  });
});

// Or with waitFor
import { waitFor } from '@testing-library/react';
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

**Error Testing:**
```typescript
// Testing thrown errors
describe('error handling', () => {
  it('handles API errors', async () => {
    const mockApi = { 
      list: vi.fn().mockRejectedValue(new ApiError(500, 'Server error'))
    };
    
    const { result } = renderHook(() => useResource(mockApi, getId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.error).toBe('Server error');
  });
  
  it('throws HttpError with correct status', () => {
    expect(() => {
      throw new HttpError(404, 'Not found');
    }).toThrow();
  });
});
```

**Testing React Components with Props:**
```typescript
describe('Button component', () => {
  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
  
  it('disables when loading', () => {
    const { getByRole } = render(<Button loading>Save</Button>);
    expect(getByRole('button')).toBeDisabled();
  });
});
```

## Recommended Test Setup

**If implementing tests for this project:**

1. Install Vitest and dependencies:
   ```bash
   pnpm add -D vitest @vitest/ui
   pnpm add -D @testing-library/react @testing-library/jest-dom
   pnpm add -D jsdom
   ```

2. Create `vitest.config.ts` in each app:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   
   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/__tests__/setup.ts'],
     },
   });
   ```

3. Add test scripts to `package.json`:
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

4. Create `src/__tests__/setup.ts` for test utilities and mocks

---

*Testing analysis: 2026-09-03*
