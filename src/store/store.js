import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';

import fileProcessingReducer from './slices/fileProcessingSlice';
import settingsReducer from './slices/settingsSlice';

const persistConfig = {
  key: 'transcribe-app',
  storage,
  whitelist: ['settings'], // Only persist settings, not fileProcessing due to File objects
};

const rootReducer = combineReducers({
  fileProcessing: fileProcessingReducer,
  settings: settingsReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST', 
          'persist/REHYDRATE',
          'fileProcessing/addFiles',
          'fileProcessing/generateSpeech/fulfilled',
          'fileProcessing/generateSpeech/pending',
          'fileProcessing/generateSpeech/rejected'
        ],
        ignoredPaths: [
          'register',
          'fileProcessing.files',
          'fileProcessing.files.finalAudio.blob',
          '_persist'
        ]
      },
    }),
});

export const persistor = persistStore(store);

// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;