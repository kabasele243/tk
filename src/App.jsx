import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';

import './css/style.css';

// Import pages
import TranscribeBatch from './pages/TranscribeBatch';

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-lg text-gray-600">Loading...</div></div>} persistor={persistor}>
        <TranscribeBatch />
      </PersistGate>
    </Provider>
  );
}

export default App;
