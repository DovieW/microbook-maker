# State Management Guide

This document explains the new state management architecture implemented in Phase 2 of the MicroBook Maker frontend refactoring.

## Overview

The state management has been refactored to eliminate prop drilling and provide better organization of related state. The implementation uses a combination of:

1. **useReducer hooks** for complex, related state within components
2. **React Context API** for sharing state across the component tree
3. **Custom hooks** for encapsulating state logic and business rules
4. **Zustand** (optional) for lightweight global state management

## Architecture

### 1. Domain-Specific Hooks

#### `useBookInfo`
Manages book metadata state using useReducer:
- Book name, author, series, year
- Async book info fetching from OpenLibrary API
- Centralized book info updates

#### `usePdfOptions`
Manages PDF generation options:
- Font size and border style
- Simple state with useReducer for consistency

#### `useFileState`
Manages file-related state and calculations:
- File name, word count, sheets count, read time
- Upload validation logic
- Automatic calculations when file or font size changes

#### `useGenerationState`
Manages PDF generation and loading states:
- Loading states for book info and PDF generation
- Generation ID tracking

#### `useFileHandling`
Composite hook that combines file operations:
- File upload handling
- Font size change logic with validation
- PDF generation workflow

### 2. Context API

#### `AppContext`
Provides centralized access to all state management hooks:
- Eliminates prop drilling
- Single source of truth for component state
- Type-safe context with proper error handling

### 3. Component Refactoring

All components have been refactored to use the context:
- **BookInfoForm**: Uses context directly, no props needed
- **PdfOptions**: Uses context and file handling hook
- **FileControls**: Uses context for state, file handling for actions
- **GenerationStatus**: Uses context for loading state and generation ID

### 4. Global State (Zustand)

For state that needs to persist across sessions or be shared globally:
- Theme preferences
- User settings
- Recent files history
- Global notifications

## Benefits

### Before (Prop Drilling)
```tsx
function App() {
  const [bookName, setBookName] = useState('');
  const [author, setAuthor] = useState('');
  // ... 13+ state variables
  
  return (
    <BookInfoForm
      bookName={bookName}
      setBookName={setBookName}
      author={author}
      setAuthor={setAuthor}
      // ... many props
    />
  );
}
```

### After (Context + Hooks)
```tsx
function App() {
  return (
    <AppProvider>
      <BookInfoForm /> {/* No props needed */}
    </AppProvider>
  );
}

function BookInfoForm() {
  const { bookInfo, setBookName, setAuthor } = useAppContext();
  // Clean, focused component
}
```

## Usage Examples

### Adding New State
1. Create a new hook in `/hooks/`
2. Add it to the AppContext provider
3. Use it in components via `useAppContext()`

### Complex State Logic
Use useReducer for related state that changes together:
```tsx
const [state, dispatch] = useReducer(reducer, initialState);
```

### Global State
Use Zustand for app-wide state:
```tsx
const theme = useAppStore(state => state.theme);
const setTheme = useAppStore(state => state.setTheme);
```

## Best Practices

1. **Keep related state together** in the same hook/reducer
2. **Use custom hooks** to encapsulate business logic
3. **Prefer Context** for component tree state sharing
4. **Use Zustand** only for truly global state
5. **Type everything** for better developer experience
6. **Use selectors** to optimize re-renders

## Migration Notes

- All components now use context instead of props
- State logic is centralized in custom hooks
- Business rules are co-located with state
- Type safety is maintained throughout
- No breaking changes to component interfaces (they just don't need props anymore)
