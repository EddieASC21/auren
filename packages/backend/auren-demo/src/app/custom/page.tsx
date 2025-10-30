"use client";

import { useState, useRef, useEffect } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Input,
    IconButton,
    Spinner,
    Image,
    Button,
} from "@chakra-ui/react";
import { ArrowUpIcon, AddIcon } from "@chakra-ui/icons";
import { useRouter } from "next/navigation";

export default function CustomPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<
        { role: "user" | "assistant"; content: string; image?: string }[]
    >([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: "user" as const, content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: input }),
            });
            const data = await res.json();

            if (data.imageUrl) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: "Here’s your design!",
                        image: data.imageUrl,
                    },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Got it! Let’s refine that idea." },
                ]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            minH="100vh"
            bg="black"
            color="white"
            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            p={6}
            position="relative"
        >
            {/* Progress bar */}
            <Box position="absolute" top={8} left={8}>
                <Text fontSize="lg" mb={2}>
                    02
                </Text>
                <Box w="200px" h="4px" bg="whiteAlpha.400" borderRadius="full">
                    <Box w="50%" h="100%" bg="white" borderRadius="full" />
                </Box>
            </Box>

            {/* Chat area */}
            <VStack
                w={["95%", "70%", "50%"]}
                h="75vh"
                bg="whiteAlpha.100"
                borderRadius="2xl"
                p={6}
                overflowY="auto"
                gap={4}
            >
                {messages.length === 0 && (
                    <Text color="gray.400" textAlign="center" mt="30%">
                        Describe your idea — text, logo, or vibe. We’ll turn it into a design.
                    </Text>
                )}

                {messages.map((msg, idx) => (
                    <Box
                        key={idx}
                        alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
                        bg={msg.role === "user" ? "blue.600" : "whiteAlpha.200"}
                        p={3}
                        borderRadius="lg"
                        maxW="80%"
                    >
                        <Text>{msg.content}</Text>
                        {msg.image && (
                            <Image
                                src={msg.image}
                                alt="Generated design"
                                borderRadius="md"
                                mt={3}
                                w="250px"
                                h="auto"
                            />
                        )}
                    </Box>
                ))}

                {loading && (
                    <HStack>
                        <Spinner size="sm" />
                        <Text color="gray.400">Generating design...</Text>
                    </HStack>
                )}

                <div ref={messagesEndRef} />
            </VStack>

            {/* Input bar */}
            <HStack
                mt={4}
                w={["95%", "70%", "50%"]}
                bg="whiteAlpha.200"
                borderRadius="full"
                p={2}
            >
                <Input
                    placeholder="Describe your idea..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    border="none"
                    bg="transparent"
                    _placeholder={{ color: "gray.400" }}
                    color="white"
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <IconButton
                    aria-label="Upload"
                    variant="ghost"
                    color="gray.300"
                    onClick={() => alert("Upload feature coming soon!")}
                >
                    <AddIcon />
                </IconButton>
                <IconButton
                    aria-label="Send"
                    colorScheme="blue"
                    borderRadius="full"
                    onClick={handleSend}
                    disabled={loading}
                >
                    {loading ? <Spinner size="sm" /> : <ArrowUpIcon />}
                </IconButton>
            </HStack>

            {/* Continue button */}
            <Button
                mt={10}
                borderRadius="full"
                bg="whiteAlpha.200"
                _hover={{ bg: "whiteAlpha.300" }}
                onClick={() => router.push("/order")}
            >
                Next
            </Button>
        </Box>
    );
}