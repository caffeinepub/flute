import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export type { LocalUser } from "../context/AuthContext";

export function useLocalAuth() {
  return useContext(AuthContext);
}
