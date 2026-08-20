/**
 * App shell: header, page content (Outlet) and footer.
 */

import { Outlet } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToHash from "../components/ScrollToHash";

const Layout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ScrollToHash />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:px-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;