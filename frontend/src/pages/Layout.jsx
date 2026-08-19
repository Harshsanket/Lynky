import { Outlet } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import { useEffect } from 'react';
import { useLocation } from 'react-router';

const Layout = () => {
  function ScrollToHash() {

  const { hash } = useLocation();

  useEffect(() => {

    if (!hash) return;

    const id = decodeURIComponent(hash.slice(1));

    requestAnimationFrame(() => {

      document.getElementById(id)?.scrollIntoView({

        behavior: 'smooth',

        block: 'start',

      });

    });

  }, [hash]);

  return null;

}
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