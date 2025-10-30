"use client";

import { useState, useRef, useEffect } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Heading,
    Textarea,
    Image,
    Button,
    IconButton,
    Spinner,
    Slider,
} from "@chakra-ui/react";
import { ArrowUpIcon } from "@chakra-ui/icons";
import { useRouter } from "next/navigation";
import { loadLocal } from "../utils/storage";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export default function OrderPage() {
    const router = useRouter();

    const [quantity, setQuantity] = useState<number>(45);
    const [pricePerUnit, setPricePerUnit] = useState<number>(9);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [design, setDesign] = useState<any>(null);

    const totalCost = quantity * pricePerUnit;
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const storedDesign = loadLocal("aurenDesign");
        if (storedDesign) {
            setDesign(storedDesign);
            // Optional: add a welcome chat message
            setMessages([
                {
                    role: "assistant",
                    content: `Welcome back! You're ordering your "${storedDesign.prompt}" design. Let's finalize quantities and materials.`,
                },
            ]);
        }
    }, []);

    const handleSend = () => {
        if (!input.trim()) return;
        const userMsg: ChatMessage = { role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        // Simulate assistant response
        setTimeout(() => {
            const botReply: ChatMessage = {
                role: "assistant",
                content: "Got it! We'll note those details. Anything else?",
            };
            setMessages((prev) => [...prev, botReply]);
            setLoading(false);
        }, 1000);
    };

    return (
        <Box
            minH="100vh"
            bg="black"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            position="relative"
            p={10}
        >
            {/* Progress bar */}
            <Box position="absolute" top={8} left={8}>
                <Text fontSize="lg" mb={2}>
                    03
                </Text>
                <Box w="200px" h="4px" bg="whiteAlpha.400" borderRadius="full">
                    <Box w="70%" h="100%" bg="white" borderRadius="full" />
                </Box>
            </Box>

            <HStack gap={20} align="flex-start">
                {/* Left — Design preview */}
                <VStack align="center" gap={4}>
                    {design ? (
                        <>
                            <Image
                                src={design.imageUrl}
                                alt="Your Design"
                                borderRadius="xl"
                                w="260px"
                                h="260px"
                                objectFit="contain"
                                boxShadow="lg"
                                bg={design.shirtColor || "white"}
                            />
                            <Text fontWeight="bold" fontSize="sm">
                                {design.prompt || "CUSTOM DESIGN"} ✦ MADE WITH AUREN
                            </Text>
                        </>
                    ) : (
                        <>
                            <Image
                                src="/shirt-placeholder.png"
                                alt="Your Design"
                                borderRadius="xl"
                                w="260px"
                                h="260px"
                                objectFit="contain"
                                boxShadow="lg"
                            />
                            <Text fontWeight="bold" fontSize="sm">
                                MADE WITH AUREN ✦ YOU
                            </Text>
                        </>
                    )}
                </VStack>

                {/* Center — Quantity + Chat */}
                <VStack
                    bg="whiteAlpha.100"
                    borderRadius="2xl"
                    p={8}
                    w="450px"
                    gap={6}
                    boxShadow="md"
                >
                    <Heading fontSize="2xl" mb={4}>
                        Select Order Quantity
                    </Heading>

                    <VStack
                        bg="whiteAlpha.200"
                        borderRadius="xl"
                        p={6}
                        w="full"
                        gap={4}
                    >
                        <Text fontSize="3xl" fontWeight="bold">
                            {quantity}
                        </Text>

                        {/* ✅ Chakra v3 slider syntax */}
                        <Slider.Root
                            value={[quantity]}
                            min={1}
                            max={100}
                            step={1}
                            onValueChange={(details) => {
                                const v = details.value[0];
                                setQuantity(v);
                                setPricePerUnit(v >= 50 ? 8 : 9);
                            }}
                        >
                            <Slider.Track>
                                <Slider.Range />
                            </Slider.Track>
                            <Slider.Thumb index={0} />
                        </Slider.Root>

                        <Text color="gray.300">
                            For {quantity} units, it will cost ${pricePerUnit}/unit
                        </Text>
                        <Text fontWeight="bold" fontSize="lg">
                            Total cost: ${totalCost}
                        </Text>
                    </VStack>

                    {/* Chatbox */}
                    <Box
                        w="full"
                        h="200px"
                        bg="whiteAlpha.100"
                        borderRadius="xl"
                        p={4}
                        overflowY="auto"
                    >
                        {messages.map((m, i) => (
                            <Box
                                key={i}
                                mb={2}
                                alignSelf={m.role === "user" ? "flex-end" : "flex-start"}
                                bg={m.role === "user" ? "blue.600" : "whiteAlpha.300"}
                                p={2}
                                borderRadius="lg"
                                maxW="80%"
                            >
                                <Text>{m.content}</Text>
                            </Box>
                        ))}
                        {loading && (
                            <HStack>
                                <Spinner size="sm" />
                                <Text color="gray.400">Thinking…</Text>
                            </HStack>
                        )}
                        <div ref={messagesEndRef} />
                    </Box>

                    <HStack w="full" bg="whiteAlpha.200" borderRadius="full" p={2}>
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Add sizing or comments (e.g. 20 S, 10 M, 15 L)"
                            resize="none"
                            bg="transparent"
                            border="none"
                            color="white"
                            rows={1}
                            onKeyDown={(e) =>
                                e.key === "Enter" && !e.shiftKey && handleSend()
                            }
                        />
                        <IconButton
                            aria-label="Send"
                            colorScheme="blue"
                            borderRadius="full"
                            onClick={handleSend}
                            disabled={loading}
                        >
                            <ArrowUpIcon />
                        </IconButton>
                    </HStack>
                </VStack>
            </HStack>

            {/* Next button */}
            <Button
                position="absolute"
                right={10}
                bottom={10}
                borderRadius="full"
                bg="whiteAlpha.200"
                _hover={{ bg: "whiteAlpha.300" }}
                onClick={() => {
                    const draft = {
                        design,
                        quantity,
                        totalCost,
                        notes: messages.map((m) => m.content),
                    };
                    localStorage.setItem("aurenOrderDraft", JSON.stringify(draft));
                    router.push("/review");
                }}
            >
                Next
            </Button>
        </Box>
    );
}