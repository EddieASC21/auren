"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Box,
    VStack,
    HStack,
    Text,
    Heading,
    Button,
    Input,
    Image,
    IconButton,
    DialogRoot,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogBody,
    DialogFooter,
    DialogCloseTrigger,
} from "@chakra-ui/react";
import { ArrowUpIcon, AddIcon, EditIcon } from "@chakra-ui/icons";
import { HexColorPicker } from "react-colorful";
import { saveLocal } from "../utils/storage";

type TextOverlay = {
    id: number;
    content: string;
    isEditing: boolean;
    x: number;
    y: number;
};

export default function VertexPage() {
    const router = useRouter();

    const [prompt, setPrompt] = useState("");
    const [lastPrompt, setLastPrompt] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [appliedImage, setAppliedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [shirtColor, setShirtColor] = useState("#ffffff");
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);

    // Image transform states
    const [imageSize, setImageSize] = useState(200);
    const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
    const [isResizing, setIsResizing] = useState(false);

    // Generate or refine image
    const handleGenerate = async (customPrompt?: string) => {
        const runPrompt = customPrompt || lastPrompt || prompt;
        if (!runPrompt.trim()) return;

        setLastPrompt(runPrompt);
        setLoading(true);

        try {
            const res = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: runPrompt }),
            });
            const data = await res.json();

            if (data.imageUrl) {
                setPreviewImage(data.imageUrl);
            } else {
                console.error(data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefine = async () => {
        if (!previewImage) return;
        setLoading(true);

        try {
            // Ask Gemini for refinement suggestion
            const textRes = await fetch("/api/refine-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: previewImage.split(",")[1],
                    lastPrompt,
                }),
            });

            const { suggestion, error: refineError } = await textRes.json();
            if (refineError || !suggestion) {
                console.error("Gemini refine failed:", refineError);
                return;
            }

            // Call Imagen refine endpoint
            const regenRes = await fetch("/api/regenerate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: previewImage.split(",")[1],
                    suggestion,
                }),
            });

            const { imageUrl, error: regenError } = await regenRes.json();
            if (regenError || !imageUrl) {
                console.error("Imagen refine failed:", regenError);
            } else {
                setPreviewImage(imageUrl);
            }
        } catch (err) {
            console.error("Refine error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddText = () => {
        setTextOverlays((prev) => [
            ...prev,
            {
                id: Date.now(),
                content: "Your Text",
                isEditing: true,
                x: 0,
                y: 0,
            },
        ]);
    };

    const handleTextChange = (id: number, newValue: string) => {
        setTextOverlays((prev) =>
            prev.map((t) => (t.id === id ? { ...t, content: newValue } : t))
        );
    };

    const toggleEdit = (id: number, editing: boolean) => {
        setTextOverlays((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isEditing: editing } : t))
        );
    };

    const updateTextPosition = (id: number, x: number, y: number) => {
        setTextOverlays((prev) =>
            prev.map((t) => (t.id === id ? { ...t, x, y } : t))
        );
    };

    const handleUseDesign = () => {
        if (!previewImage) return;

        const designData = {
            imageUrl: previewImage,
            prompt: lastPrompt,
            shirtColor,
            textOverlays,
            timestamp: Date.now(),
        };

        saveLocal("aurenDesign", designData);
        setAppliedImage(previewImage);
        router.push("/order");
    };

    const handleRedesign = () => {
        setAppliedImage(null);
        setPreviewImage(null);
        setPrompt("");
        setLastPrompt("");
    };

    return (
        <Box display="flex" minH="100vh" bg="black" color="white">
            {/* Left Panel */}
            <Box
                w="30%"
                p={10}
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                borderRight="1px solid"
                borderColor="gray.800"
            >
                <VStack align="start" gap={5}>
                    <Text fontSize="xl" opacity={0.8}>
                        02
                    </Text>
                    <Box h="2px" w="60%" bg="whiteAlpha.400" borderRadius="full" />

                    <Heading fontSize="4xl" fontWeight="bold">
                        Chat
                    </Heading>

                    {!previewImage ? (
                        <Text color="gray.300" fontSize="md">
                            Describe your idea — text, logo, vibe, or upload inspo pics &
                            we’ll recreate it!
                        </Text>
                    ) : (
                        <VStack align="start" gap={3}>
                            <Text color="gray.300">
                                Here’s your generated design — choose to refine, use it, or start over.
                            </Text>

                            <Image
                                src={previewImage}
                                alt="Generated preview"
                                borderRadius="lg"
                                w="180px"
                                h="180px"
                                objectFit="cover"
                                bg="gray.900"
                            />

                            <HStack>
                                <Button
                                    size="sm"
                                    bg="whiteAlpha.200"
                                    _hover={{ bg: "whiteAlpha.300" }}
                                    onClick={handleRefine}
                                    loading={loading}
                                >
                                    Refine
                                </Button>
                                <Button
                                    size="sm"
                                    bg="white"
                                    color="black"
                                    _hover={{ bg: "gray.200" }}
                                    onClick={handleUseDesign}
                                >
                                    Use this design
                                </Button>
                                <Button
                                    size="sm"
                                    bg="whiteAlpha.200"
                                    _hover={{ bg: "whiteAlpha.300" }}
                                    onClick={handleRedesign}
                                >
                                    Redesign
                                </Button>
                            </HStack>
                        </VStack>
                    )}
                </VStack>

                {/* Input box */}
                <HStack
                    mt={8}
                    bg="whiteAlpha.100"
                    borderRadius="full"
                    p={2}
                    w="full"
                    justify="space-between"
                >
                    <Input
                        placeholder="Make a minimalist white spaceship"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        _placeholder={{ color: "gray.500" }}
                    />
                    <HStack>
                        <IconButton
                            aria-label="upload"
                            variant="ghost"
                            color="gray.400"
                            _hover={{ color: "white" }}
                        >
                            <AddIcon />
                        </IconButton>
                        <IconButton
                            aria-label="send"
                            colorScheme="blue"
                            borderRadius="full"
                            onClick={() => handleGenerate(prompt)}
                            loading={loading}
                        >
                            <ArrowUpIcon />
                        </IconButton>
                    </HStack>
                </HStack>
            </Box>

            {/* Center - Shirt Preview */}
            <Box
                flex="1"
                bg="#f4f2ed"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                position="relative"
            >
                <Box
                    position="relative"
                    w="340px"
                    h="340px"
                    borderRadius="xl"
                    bg={shirtColor}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                >
                    <Image
                        src="/shirt-placeholder.png"
                        alt="Classic T-Shirt"
                        w="340px"
                        h="340px"
                        objectFit="contain"
                        position="absolute"
                        top="0"
                        left="0"
                    />

                    {/* Draggable + Resizable Image */}
                    {appliedImage && (
                        <Box
                            position="absolute"
                            left="50%"
                            top="50%"
                            transform="translate(-50%, -50%)"
                            cursor="grab"
                        >
                            <Image
                                src={appliedImage}
                                alt="Applied Design"
                                w={`${imageSize}px`}
                                h="auto"
                                borderRadius="md"
                                opacity={0.95}
                                userSelect="none"
                            />
                        </Box>
                    )}

                    {/* Text overlays */}
                    {textOverlays.map((txt) => (
                        <Box
                            key={txt.id}
                            position="absolute"
                            left="50%"
                            top="50%"
                            transform="translate(-50%, -50%)"
                        >
                            {txt.isEditing ? (
                                <Input
                                    value={txt.content}
                                    autoFocus
                                    onChange={(e) => handleTextChange(txt.id, e.target.value)}
                                    onBlur={() => toggleEdit(txt.id, false)}
                                    fontSize="xl"
                                    fontWeight="bold"
                                    textAlign="center"
                                    bg="whiteAlpha.700"
                                    color="black"
                                    borderRadius="md"
                                    px={2}
                                />
                            ) : (
                                <Text
                                    fontWeight="bold"
                                    fontSize="xl"
                                    color="black"
                                    cursor="pointer"
                                    onClick={() => toggleEdit(txt.id, true)}
                                >
                                    {txt.content}
                                </Text>
                            )}
                        </Box>
                    ))}
                </Box>

                <Text mt={4} fontSize="sm" color="black">
                    CLASSIC T-SHIRT
                </Text>
            </Box>

            {/* Right - Design Tools */}
            <Box
                w="25%"
                p={10}
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                borderLeft="1px solid"
                borderColor="gray.800"
            >
                <VStack align="start" gap={5}>
                    <Heading fontSize="3xl">Design tools</Heading>

                    <Button
                        bg="whiteAlpha.200"
                        w="full"
                        borderRadius="md"
                        _hover={{ bg: "whiteAlpha.300" }}
                        onClick={handleAddText}
                    >
                        <AddIcon />
                        &nbsp; Add Text
                    </Button>

                    <Button
                        bg="whiteAlpha.200"
                        w="full"
                        borderRadius="md"
                        _hover={{ bg: "whiteAlpha.300" }}
                    >
                        <AddIcon />
                        &nbsp; Upload Logo/Image
                    </Button>

                    <Button
                        bg="whiteAlpha.200"
                        w="full"
                        borderRadius="md"
                        _hover={{ bg: "whiteAlpha.300" }}
                        onClick={() => setColorPickerOpen(true)}
                    >
                        <EditIcon />
                        &nbsp; Edit Color
                    </Button>
                </VStack>

                <Button
                    alignSelf="flex-end"
                    borderRadius="full"
                    bg="whiteAlpha.200"
                    w="140px"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={() => router.push("/order")}
                >
                    Next
                </Button>
            </Box>

            {/* Color Picker Dialog */}
            <DialogRoot
                open={colorPickerOpen}
                onOpenChange={(details) => setColorPickerOpen(details.open)}
            >
                <DialogContent bg="gray.900" color="white" p={4} borderRadius="lg">
                    <DialogHeader>
                        <DialogTitle>Edit Shirt Color</DialogTitle>
                        <DialogCloseTrigger />
                    </DialogHeader>
                    <DialogBody display="flex" justifyContent="center">
                        <HexColorPicker color={shirtColor} onChange={setShirtColor} />
                    </DialogBody>
                    <DialogFooter justifyContent="flex-end">
                        <Button
                            bg="whiteAlpha.200"
                            _hover={{ bg: "whiteAlpha.300" }}
                            onClick={() => setColorPickerOpen(false)}
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </DialogRoot>
        </Box>
    );
}