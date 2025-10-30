"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
} from "@chakra-ui/react";

export default function Home() {
  const router = useRouter();

  return (
    <Box
      minH="100vh"
      bgGradient="linear(to-b, white, gray.50)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={8}
    >
      <VStack gap={10} maxW="800px" textAlign="center">
        <Heading size="2xl" fontWeight="bold" color="gray.800">
          Welcome to Auren Demo
        </Heading>

        <Text fontSize="lg" color="gray.600">
          AI-powered product customization platform
        </Text>

        <HStack gap={10} w="full" justify="center" flexWrap="wrap">
          <Box
            p={8}
            w="300px"
            bg="white"
            shadow="md"
            rounded="2xl"
            borderWidth="1px"
            borderColor="gray.100"
            cursor="pointer"
            _hover={{ transform: "scale(1.02)", shadow: "lg" }}
            transition="all 0.2s"
            onClick={() => router.push("/openai")}
          >
            <Heading size="md" mb={3}>
              Start Customizing
            </Heading>
            <Text color="gray.600" mb={5}>
              Create custom products with AI assistance
            </Text>
            <Button colorScheme="blue" w="full">
              Get Started
            </Button>
          </Box>

          <Box
            p={8}
            w="300px"
            bg="white"
            shadow="md"
            rounded="2xl"
            borderWidth="1px"
            borderColor="gray.100"
            cursor="pointer"
            _hover={{ transform: "scale(1.02)", shadow: "lg" }}
            transition="all 0.2s"
            onClick={() => router.push("/demo")}
          >
            <Heading size="md" mb={3}>
              API Demo
            </Heading>
            <Text color="gray.600" mb={5}>
              Test all available API endpoints
            </Text>
            <Button colorScheme="purple" w="full">
              Try APIs
            </Button>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
}