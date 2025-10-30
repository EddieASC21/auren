"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { EmotionCacheProvider } from "./emotion-cache";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EmotionCacheProvider>
      <ChakraProvider value={defaultSystem}>
        {children}
      </ChakraProvider>
    </EmotionCacheProvider>
  );
}