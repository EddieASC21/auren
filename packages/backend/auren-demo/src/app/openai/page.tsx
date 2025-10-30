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

export default function OpenAIPage() {
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
                    Let’s make your <br /> custom products!
                </Heading>

                <Text fontSize="lg" color="gray.600">
                    Choose how you want to start your journey.
                </Text>

                <HStack gap={10} w="full" justify="center" flexWrap="wrap">
                    {/* Catalog Option */}
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
                        onClick={() => router.push("/gemini")}
                    >
                        <Heading size="md" mb={3}>
                            Catalog
                        </Heading>
                        <Text color="gray.600" mb={5}>
                            Browse our catalog for basic apparel & more.
                        </Text>
                        <VStack align="start" gap={1}>
                            <Text fontWeight="semibold">✔️ Best prices & low minimums</Text>
                            <Text fontWeight="semibold">✔️ Premium quality</Text>
                        </VStack>
                        <Button mt={6} colorScheme="blue" w="full">
                            Start Making
                        </Button>
                    </Box>

                    {/* Custom Option */}
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
                        onClick={() => router.push("/custom")}
                    >
                        <Heading size="md" mb={3}>
                            Custom
                        </Heading>
                        <Text color="gray.600" mb={5}>
                            Create any custom product outside our catalog.
                        </Text>
                        <VStack align="start" gap={1}>
                            <Text fontWeight="semibold">✔️ Total creative freedom</Text>
                            <Text fontWeight="semibold">✔️ Transparent pricing</Text>
                        </VStack>
                        <Button mt={6} colorScheme="purple" w="full">
                            Start Making
                        </Button>
                    </Box>
                </HStack>
            </VStack>
        </Box>
    );
}