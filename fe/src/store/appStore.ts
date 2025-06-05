import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Example Zustand store for global state management
// This can be used for state that needs to be shared across multiple components
// that are not directly connected in the component tree

interface AppStore {
  // Theme state
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // User preferences
  preferences: {
    autoSave: boolean;
    defaultFontSize: string;
    defaultBorderStyle: string;
  };
  updatePreferences: (preferences: Partial<AppStore['preferences']>) => void;
  
  // Global notifications/alerts
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: number;
  }>;
  addNotification: (notification: Omit<AppStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  
  // Recent files/history
  recentFiles: Array<{
    id: string;
    name: string;
    lastModified: number;
    wordCount: number;
  }>;
  addRecentFile: (file: Omit<AppStore['recentFiles'][0], 'id'>) => void;
  removeRecentFile: (id: string) => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Theme state
      theme: 'light',
      setTheme: (theme) => set({ theme }, false, 'setTheme'),
      
      // User preferences
      preferences: {
        autoSave: true,
        defaultFontSize: '6',
        defaultBorderStyle: 'dashed',
      },
      updatePreferences: (newPreferences) =>
        set(
          (state) => ({
            preferences: { ...state.preferences, ...newPreferences },
          }),
          false,
          'updatePreferences'
        ),
      
      // Global notifications
      notifications: [],
      addNotification: (notification) =>
        set(
          (state) => ({
            notifications: [
              ...state.notifications,
              {
                ...notification,
                id: Date.now().toString(),
                timestamp: Date.now(),
              },
            ],
          }),
          false,
          'addNotification'
        ),
      removeNotification: (id) =>
        set(
          (state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }),
          false,
          'removeNotification'
        ),
      
      // Recent files
      recentFiles: [],
      addRecentFile: (file) =>
        set(
          (state) => {
            const newFile = { ...file, id: Date.now().toString() };
            const filteredFiles = state.recentFiles.filter(
              (f) => f.name !== file.name
            );
            return {
              recentFiles: [newFile, ...filteredFiles].slice(0, 10), // Keep only 10 recent files
            };
          },
          false,
          'addRecentFile'
        ),
      removeRecentFile: (id) =>
        set(
          (state) => ({
            recentFiles: state.recentFiles.filter((f) => f.id !== id),
          }),
          false,
          'removeRecentFile'
        ),
    }),
    {
      name: 'microbook-maker-store',
    }
  )
);

// Selectors for optimized re-renders
export const useTheme = () => useAppStore((state) => state.theme);
export const usePreferences = () => useAppStore((state) => state.preferences);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useRecentFiles = () => useAppStore((state) => state.recentFiles);
