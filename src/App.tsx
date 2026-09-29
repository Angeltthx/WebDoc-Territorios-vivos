import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Webdoc } from './ui/screens/Webdoc';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Webdoc />} />
        <Route path="/:page" element={<Webdoc />} />
        <Route path="*" element={<Webdoc />} />
      </Routes>
    </BrowserRouter>
  );
}
