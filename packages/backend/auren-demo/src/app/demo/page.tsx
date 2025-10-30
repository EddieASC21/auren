"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Input,
  Textarea,
  Image,
  VStack,
  Heading,
  Spinner,
} from "@chakra-ui/react";

export default function DemoPage() {
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageReply, setImageReply] = useState("");

  const [quantity, setQuantity] = useState<number>(10);
  const [quote, setQuote] = useState("");

  const [notes, setNotes] = useState("");
  const [assistantReply, setAssistantReply] = useState("");

  const [draftResult, setDraftResult] = useState("");
  const [loading, setLoading] = useState(false);

  const Separator = () => (
    <Box my={6} borderBottom="1px solid" borderColor="gray.700" />
  );

  // Chat API
  const handleChat = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: chatInput }),
      });
      const data = await res.json();
      setChatResponse(data.reply ?? JSON.stringify(data));
    } finally {
      setLoading(false);
    }
  };

  // Image Generation API
  const handleGenerateImage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            imagePrompt.trim() ||
            "render a futuristic cotton t-shirt with a chrome logo",
        }),
      });
      const data = await res.json();

      if (data.imageUrl) {
        setImageReply(
          `<img src="${data.imageUrl}" alt="Generated Design" width="320" />`
        );
      } else if (data.description) {
        setImageReply(`<pre>${data.description}</pre>`);
      } else if (data.error) {
        setImageReply(`<pre style="color:#f56565">${data.error}</pre>`);
      } else {
        setImageReply("No image or description returned.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Pricing API
  const handleQuote = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      setQuote(data.quote ?? JSON.stringify(data));
    } finally {
      setLoading(false);
    }
  };

  // Assistant API
  const handleAssistant = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: notes }),
      });
      const data = await res.json();
      setAssistantReply(data.reply ?? JSON.stringify(data));
    } finally {
      setLoading(false);
    }
  };

  // Draft API
  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: "tee-classic",
          quantity,
          notes,
          design: { color: "navy" },
        }),
      });
      const data = await res.json();
      setDraftResult(JSON.stringify(data, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={6} maxW="900px">
      <Heading mb={6}>🧩 Auren Demo Panel</Heading>

      {loading && (
        <Box textAlign="center" mb={4}>
          <Spinner size="lg" />
        </Box>
      )}

      <VStack gap={8} align="stretch">
        {/* Chat */}
        <Box>
          <Heading size="md" mb={2}>
            Chat with Gemini
          </Heading>
          <Input
            placeholder="Ask Gemini something..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <Button mt={3} colorScheme="blue" onClick={handleChat}>
            Send
          </Button>
          <Box mt={3} whiteSpace="pre-wrap">
            {chatResponse}
          </Box>
        </Box>

        <Separator />

        {/* Image Generator */}
        <Box>
          <Heading size="md" mb={2}>
            Generate Image
          </Heading>
          <Input
            placeholder="Describe the image to generate (e.g., 'blue hoodie with embroidered logo')"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <Button mt={3} colorScheme="purple" onClick={handleGenerateImage}>
            Generate
          </Button>
          <Box mt={3}>
            <div dangerouslySetInnerHTML={{ __html: imageReply }} />
          </Box>
        </Box>

        <Separator />

        {/* Pricing */}
        <Box>
          <Heading size="md" mb={2}>
            Get Quote
          </Heading>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value || "0", 10))}
          />
          <Button mt={3} colorScheme="green" onClick={handleQuote}>
            Get Quote
          </Button>
          <Box mt={3}>{quote}</Box>
        </Box>

        <Separator />

        {/* Assistant */}
        <Box>
          <Heading size="md" mb={2}>
            Order Assistant
          </Heading>
          <Textarea
            placeholder="Example: 20 small, 10 medium, 15 large, lightweight cotton"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button mt={3} colorScheme="orange" onClick={handleAssistant}>
            Ask Assistant
          </Button>
          <Box mt={3} whiteSpace="pre-wrap">
            {assistantReply}
          </Box>
        </Box>

        <Separator />

        {/* Draft */}
        <Box>
          <Heading size="md" mb={2}>
            Save Draft
          </Heading>
          <Button colorScheme="gray" onClick={handleSaveDraft}>
            Save Draft
          </Button>
          <Box as="pre" mt={3} p={3} bg="gray.800" borderRadius="md" overflowX="auto">
            {draftResult}
          </Box>
        </Box>
      </VStack>
    </Box>
  );
}