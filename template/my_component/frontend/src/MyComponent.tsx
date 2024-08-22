import React, { ReactNode } from "react";
import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection,
} from "streamlit-component-lib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface State {
  isSpeaking: boolean;
  audioUrl: string | null;
  sceneInitialized: boolean;
}

class MyComponent extends StreamlitComponentBase<State> {
  public state = {
    isSpeaking: false,
    audioUrl: null,
    sceneInitialized: false,
  };

  private containerRef = React.createRef<HTMLDivElement>();
  private mixer: THREE.AnimationMixer | null = null;

  public render = (): ReactNode => {
    const { theme } = this.props;
    const { isSpeaking, audioUrl } = this.state;

    const buttonStyle: React.CSSProperties = {};

    if (theme) {
      const borderStyling = `1px solid ${
        isSpeaking ? theme.primaryColor : "gray"
      }`;
      buttonStyle.border = borderStyling;
      buttonStyle.outline = borderStyling;
    }

    const containerStyle: React.CSSProperties = {
      width: '100%',
      height: '500px', // Fixed height for the avatar display
      border: '1px solid #ccc',
    };

    return (
      <div>
        <button
          style={buttonStyle}
          onClick={this.handleSpeakClick}
        >
          {isSpeaking ? "Stop Speaking" : "Speak"}
        </button>
        {audioUrl && <audio src={audioUrl} controls />}
        <div ref={this.containerRef} style={containerStyle} /> {/* Avatar container */}
      </div>
    );
  };

  private handleSpeakClick = (): void => {
    const text = this.props.args["name"];
    if (text) {
      if (!this.state.isSpeaking) {
        this.generateAndPlaySpeech(text);
      } else {
        this.stopSpeaking();
      }
    } else {
      console.error("No text provided in the arguments.");
    }
  };

  private generateAndPlaySpeech = async (text: string): Promise<void> => {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": "ffccce1f016467b81da793bac0174bfe",
        },
        body: JSON.stringify({
          text: text,
          voice_settings: {
            stability: 0.0,
            similarity_boost: 1.0,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error generating speech");
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);

      this.setState({ isSpeaking: true, audioUrl: url }, () => {
        if (!this.state.sceneInitialized) {
          this.initializeScene();
          this.setState({ sceneInitialized: true });
        }
        this.playAudioWithLipSync(url);
        Streamlit.setComponentValue(url);
      });
    } catch (error) {
      console.error("Error generating speech:", error);
    }
  };

  private stopSpeaking = (): void => {
    this.setState({ isSpeaking: false });
  };

  private initializeScene = (): void => {
    console.log("Initializing scene...");
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, this.containerRef.current!.clientWidth / this.containerRef.current!.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 2);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(this.containerRef.current!.clientWidth, this.containerRef.current!.clientHeight);
    renderer.setClearColor(0x333333); // Dark background color

    if (this.containerRef.current) {
      this.containerRef.current.appendChild(renderer.domElement);
    }

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const loader = new GLTFLoader();

    // Load the avatar model
    loader.load(
      "/65a8dba831b23abb4f401bae.glb",
      (gltf) => {
        const avatar = gltf.scene;
        scene.add(avatar);

        this.mixer = new THREE.AnimationMixer(avatar);

        // Load animations separately
        loader.load(
          "/animations.glb",
          (gltfAnimations) => {
            const animations = gltfAnimations.animations;

            const idleClip = animations.find((clip) => clip.name.toLowerCase() === "idle");
            const talkClip = animations.find((clip) => clip.name.toLowerCase() === "talking");

            let currentAction = idleClip ? this.mixer!.clipAction(idleClip) : null;

            if (currentAction) {
              currentAction.play();
            } else {
              console.error("Idle animation not found!");
            }

            const animate = (): void => {
              requestAnimationFrame(animate);
              this.mixer!.update(0.016); // Assuming 60 FPS
              renderer.render(scene, camera);
            };
            animate();

            if (talkClip) {
              const talkAction = this.mixer!.clipAction(talkClip);
              // Logic to handle the talking animation when needed
            } else {
              console.error("Talking animation not found!");
            }
          },
          undefined,
          (error) => {
            console.error("An error occurred while loading the animations:", error);
          }
        );
      },
      undefined,
      (error) => {
        console.error("An error occurred while loading the avatar:", error);
      }
    );
  };

  private playAudioWithLipSync = (url: string): void => {
    const audioElement = new Audio(url);
    audioElement.play();

    audioElement.onended = () => {
      console.log("Audio ended, switching back to idle animation...");
      this.stopSpeaking();
    };
  };
}

export default withStreamlitConnection(MyComponent);
