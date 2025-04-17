# Suno-Saarthi Frontend

This is the frontend application for Suno-Saarthi built with Next.js and Mantine UI.

## Tech Stack

- **Framework**: Next.js
- **UI Library**: Mantine UI v7
- **State Management**: Zustand
- **API Client**: React Query with OpenAPI Typescript Fetch
- **Styling**: SASS/SCSS with CSS Modules
- **Icons**: Tabler Icons
- **Maps**: Google Maps
- **Type Safety**: TypeScript

## Installation

1. Install dependencies:
```bash
yarn install
```

2. Create a `.env` file in the root directory with the following variables:
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Maps Configuration
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= <your-google-maps-api-key>
NEXT_PUBLIC_GOOGLE_MAPS_ID= <your-google-maps-id>
```

3. Start the development server:
```bash
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Development Guidelines

### API Integration

1. **Generating API Types**
   To generate TypeScript types from the OpenAPI specification:
   ```bash
   yarn openapi-typescript http://localhost:8000/openapi.json -o src/api/schemas.ts
   ```

2. **Creating API Hooks**
   - Create `.query.ts` files in the appropriate feature directory
   - Use the `generateQueryHook` utility to create API hooks
   - Example usage:
   ```typescript
   // navigation.query.ts
   export const useNavigationQuery = generateQueryHook(
     "navigationQuery",
     generateQueryHook.api.path("/api/navigation/query").method("post")
   );

   // Usage in components
   const result = await useNavigationQuery.apiCall({ param1: "value1", param2: "value2" });
   // then use result.data, result.isLoading, result.error for rendering
   ```

### Styling with SASS

1. Create `.module.scss` files alongside your components
2. Import and use styles:
   ```typescript
   import classes from './Component.module.scss';

   export function Component() {
     return <div className={classes.container}>Content</div>;
   }
   ```

### Mantine UI Components

1. Import components from `@mantine/core`:
   ```typescript
   import { Button, Text, Stack } from '@mantine/core';
   ```

2. Use Mantine's built-in styling system:
   ```typescript
   <Button variant="filled" color="blue" size="md">
     Click me
   </Button>
   ```

### Tabler Icons

1. Import icons from `@tabler/icons-react`:
   ```typescript
   import { IconMap, IconSettings } from '@tabler/icons-react';
   ```

2. Use icons in components:
   ```typescript
   <IconMap size={24} />
   ```

## Deployment

1. Build the application:
```bash
yarn build
```

2. Start the production server:
```bash
yarn start
```

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Mantine Documentation](https://mantine.dev/)
- [Tabler Icons](https://tabler-icons.io/)
- [React Query Documentation](https://tanstack.com/query/latest)
