'use client';

import { useEffect, useState } from "react";
import { auth, db } from '@/lib/firebase';
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import Image from 'next/image';

interface Message {
    text: string;
    sender: 'user' | 'bot';
    timestamp: number;
  }

export default function Chat() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true); // To handle loading state
  const router = useRouter();

  useEffect(() => {
    // Check if the user is logged in
    const unsubscribe = onAuthStateChanged(auth, async(user) => {
      if (!user) {
        // Redirect to login page if not logged in
        router.push("/login");
      } else {
        setLoading(false); // User is logged in, stop loading
        setUser(user);
        // Fetch messages from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            createdAt: Date.now(),
          });
        }
        // Listen for chat messages
        const messagesRef = collection(db, 'users', user.uid, 'messages');
        onSnapshot(messagesRef, (snapshot) => {
          const loadedMessages = snapshot.docs.map((doc) => doc.data() as Message);
          setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
        });
      }
    });

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, [router]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

//   const handleSendMessage = () => {
//     if (input.trim()) {
//       setMessages((prevMessages) => [...prevMessages, input]);
//       setInput("");
//     }
//   };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim() || !user) return;
    const userMessage: Message = {
      text: input,
      sender: 'user',
      timestamp: Date.now(),
    };
    // Save user message to Firestore
    await addDoc(collection(db, 'users', user.uid, 'messages'), userMessage);
    setInput('');

    // Call CrewAI backend
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, userId: user.uid }),
      });
      const { reply } = await response.json();
      const botMessage: Message = {
        text: reply,
        sender: 'bot',
        timestamp: Date.now() + 100,
      };
      await addDoc(collection(db, 'users', user.uid, 'messages'), botMessage);
    } catch (error) {
      console.error('CrewAI error:', error);
      const errorMessage: Message = {
        text: 'Error: Could not get response from AI agent',
        sender: 'bot',
        timestamp: Date.now() + 100,
      };
      await addDoc(collection(db, 'users', user.uid, 'messages'), errorMessage);
    }
  };

  if (loading) {
    // Show a loading message while checking authentication
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Sign Out
      </button>
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        Chat Interface
      </h1>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        
        <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <span
                    className={`inline-block p-2 rounded ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}
                  >
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
        
        <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 p-2 border rounded-l bg-white text-black"
                placeholder="Type your message..."
              />
              <button
                onClick={handleSendMessage}
                className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600"
              >
                Send
              </button>
        </div>
      </div>
    </div>
  );
}