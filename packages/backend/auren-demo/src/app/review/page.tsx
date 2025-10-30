"use client";

import { useEffect, useState } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Heading,
    Button,
    Image,
    Separator,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { loadLocal } from "../utils/storage";

type DesignData = {
    imageUrl: string;
    prompt: string;
    shirtColor: string;
    textOverlays?: any[];
    timestamp?: number;
};

type OrderData = {
    design: DesignData;
    quantity: number;
    totalCost: number;
    notes?: string[];
};

export default function ReviewPage() {
    const router = useRouter();
    const [design, setDesign] = useState<DesignData | null>(null);
    const [order, setOrder] = useState<OrderData | null>(null);

    // Load design + order draft
    useEffect(() => {
        const d = loadLocal("aurenDesign");
        const o = JSON.parse(localStorage.getItem("aurenOrderDraft") || "null");

        if (d) setDesign(d);
        if (o) setOrder(o);
    }, []);

    const handleConfirm = () => {
        // In production, send to backend or Firestore
        console.log("Submitting order:", { design, order });
        alert("✅ Order confirmed and submitted!");
        localStorage.removeItem("aurenDesign");
        localStorage.removeItem("aurenOrderDraft");
        router.push("/");
    };

    if (!design || !order) {
        return (
            <Box
                minH="100vh"
                bg="black"
                color="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexDir="column"
                gap={4}
            >
                <Text fontSize="lg" color="gray.300">
                    No review data found — please return to customization or order steps.
                </Text>
                <Button onClick={() => router.push("/vertex")} colorScheme="blue">
                    Back to Design
                </Button>
            </Box>
        );
    }

    return (
        <Box minH="100vh" bg="black" color="white" p={12}>
            {/* Header */}
            <HStack justify="space-between" mb={10}>
                <Heading size="lg">Final Review</Heading>
                <Button
                    borderRadius="full"
                    bg="whiteAlpha.200"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={() => router.push("/order")}
                >
                    ← Edit Order
                </Button>
            </HStack>

            <HStack align="flex-start" gap={16}>
                {/* Design Preview */}
                <VStack
                    align="center"
                    bg="whiteAlpha.100"
                    borderRadius="xl"
                    p={6}
                    w="320px"
                    boxShadow="lg"
                >
                    <Image
                        src={design.imageUrl}
                        alt="Final Design"
                        borderRadius="lg"
                        w="260px"
                        h="260px"
                        objectFit="contain"
                        bg={design.shirtColor || "white"}
                    />
                    <Text fontWeight="bold" fontSize="sm">
                        {design.prompt || "Custom Design"} ✦ MADE WITH AUREN
                    </Text>
                </VStack>

                {/* Order Summary */}
                <VStack
                    align="start"
                    bg="whiteAlpha.100"
                    borderRadius="xl"
                    p={8}
                    w="480px"
                    boxShadow="md"
                    gap={5}
                >
                    <Heading fontSize="2xl">Order Summary</Heading>
                    <Separator borderColor="whiteAlpha.300" />

                    <Text>
                        <b>Quantity:</b> {order.quantity} units
                    </Text>
                    <Text>
                        <b>Total Cost:</b> ${order.totalCost.toFixed(2)}
                    </Text>
                    <Text>
                        <b>Color:</b> {design.shirtColor}
                    </Text>

                    {order.notes && order.notes.length > 0 && (
                        <Box>
                            <Text mb={2}>
                                <b>Notes:</b>
                            </Text>
                            <VStack
                                align="start"
                                bg="whiteAlpha.200"
                                p={3}
                                borderRadius="md"
                                gap={1}
                            >
                                {order.notes.map((note, i) => (
                                    <Text key={i} color="gray.200">
                                        • {note}
                                    </Text>
                                ))}
                            </VStack>
                        </Box>
                    )}

                    <Separator borderColor="whiteAlpha.300" />
                    <Button
                        w="full"
                        colorScheme="blue"
                        borderRadius="full"
                        onClick={handleConfirm}
                    >
                        Confirm & Submit
                    </Button>
                </VStack>
            </HStack>
        </Box>
    );
}