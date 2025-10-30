"use client";

import { useRouter } from "next/navigation";
import {
    Box,
    Button,
    Heading,
    Text,
    HStack,
    VStack,
    SimpleGrid,
    Image,
} from "@chakra-ui/react";

const categories = [
    "Accessories",
    "Pants",
    "Sweatshirts & Hoodies",
    "T-Shirts & Tops",
];

const products = [
    { name: "Classic T-Shirt", image: "/shirt-placeholder.png" },
    { name: "Crewneck T-Shirt", image: "/shirt-placeholder.png" },
    { name: "Long Sleeve Top", image: "/shirt-placeholder.png" },
    { name: "Ribbed Tanktop", image: "/shirt-placeholder.png" },
    { name: "Cropped Tee", image: "/shirt-placeholder.png" },
    { name: "V-Neck Tee", image: "/shirt-placeholder.png" },
];

export default function GeminiPage() {
    const router = useRouter();

    return (
        <Box display="flex" minH="100vh" bg="black" color="white">
            {/* Left panel */}
            <Box
                w="30%"
                p={12}
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                borderRight="1px solid"
                borderColor="gray.800"
            >
                <VStack align="start" gap={6}>
                    <Text fontSize="xl" opacity={0.8}>
                        01
                    </Text>
                    <Box h="2px" w="60%" bg="whiteAlpha.500" borderRadius="full" />
                    <Heading fontSize="4xl" fontWeight="bold">
                        Make it fast
                    </Heading>
                    <Text fontSize="md" color="gray.300">
                        Our signature ready-made products, customized with your designs.
                    </Text>
                </VStack>

                <Button
                    mt={12}
                    w="140px"
                    borderRadius="full"
                    bg="whiteAlpha.200"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={() => router.push("/openai")}
                >
                    Back
                </Button>
            </Box>

            {/* Right panel */}
            <Box flex="1" bg="#f4f2ed" color="black" p={12} overflowY="auto">
                <Heading mb={6}>Product Catalog</Heading>

                {/* Category buttons */}
                <HStack gap={3} mb={10} flexWrap="wrap">
                    {categories.map((cat, i) => (
                        <Button
                            key={i}
                            variant={cat === "T-Shirts & Tops" ? "solid" : "outline"}
                            colorScheme={cat === "T-Shirts & Tops" ? "blackAlpha" : undefined}
                            rounded="full"
                        >
                            {cat}
                        </Button>
                    ))}
                </HStack>

                {/* Product Grid */}
                <SimpleGrid columns={[2, 3, 4]} gap={8}>
                    {products.map((p, i) => (
                        <Box
                            key={i}
                            p={4}
                            bg="white"
                            borderRadius="xl"
                            shadow="sm"
                            borderWidth="1px"
                            borderColor="gray.300"
                            textAlign="center"
                            cursor="pointer"
                            _hover={{ transform: "scale(1.05)", shadow: "md" }}
                            transition="all 0.2s"
                        >
                            <Image
                                src={p.image}
                                alt={p.name}
                                borderRadius="lg"
                                mb={3}
                                w="100%"
                                h="150px"
                                objectFit="contain"
                            />
                            <Text fontWeight="semibold" fontSize="sm">
                                {p.name}
                            </Text>
                        </Box>
                    ))}
                </SimpleGrid>

                <HStack justify="flex-end" mt={10}>
                    <Button
                        w="140px"
                        borderRadius="full"
                        bg="black"
                        color="white"
                        _hover={{ bg: "gray.800" }}
                        onClick={() => router.push("/vertex")}
                    >
                        Next
                    </Button>
                </HStack>
            </Box>
        </Box>
    );
}