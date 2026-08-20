import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { Analytics } from "@vercel/analytics/react"
import API from "./pages/API";
import  API_Usage  from "./pages/API_Usage";
import About from "./pages/About";
import Blog from "./pages/Blog";

/**
 * App — route table. All pages render inside `Layout` (header/footer shell).
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/api" element={<API />} />
          <Route path="/api/usage" element={<API_Usage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;