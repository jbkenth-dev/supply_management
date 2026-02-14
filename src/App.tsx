import { Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Supplies from "./pages/Supplies";
import ItemDetails from "./pages/ItemDetails";
import About from "./pages/About";
import SignUp from "./pages/auth/SignUp";
import Login from "./pages/auth/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="supplies" element={<Supplies />} />
        <Route path="supplies/:code" element={<ItemDetails />} />
        <Route path="about" element={<About />} />
        <Route path="auth/signup" element={<SignUp />} />
        <Route path="login" element={<Login />} />
      </Route>
    </Routes>
  );
}
