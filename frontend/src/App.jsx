import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />

          {/* Future pages */}
          {/* <Route path="/about" element={<About />} /> */}
          {/* <Route path="/privacy" element={<Privacy />} /> */}
          {/* <Route path="/terms" element={<API />} /> */}
        <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;