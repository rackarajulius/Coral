import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useScrollAnimations() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const ctx = gsap.context(() => {
      // Hero character animation
      const heroChars = document.querySelectorAll(".hero-char");
      if (heroChars.length) {
        gsap.from(heroChars, {
          opacity: 0,
          y: 60,
          rotationX: -90,
          stagger: 0.025,
          duration: 0.7,
          ease: "back.out(1.7)",
          delay: 0.3,
        });
      }

      // Hero badge
      gsap.from(".hero-badge", {
        opacity: 0,
        scale: 0.5,
        duration: 0.8,
        ease: "elastic.out(1, 0.5)",
        delay: 0.1,
      });

      // Hero subtitle & CTA
      gsap.from(".hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.8,
      });

      gsap.from(".hero-cta", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 1,
      });

      gsap.from(".hero-visual", {
        opacity: 0,
        x: 80,
        scale: 0.9,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.5,
      });

      // Feature cards
      gsap.from(".feature-card", {
        opacity: 0,
        y: 80,
        scale: 0.9,
        stagger: 0.15,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".features-section",
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      // Dashboard items
      gsap.from(".dashboard-list-item", {
        opacity: 0,
        x: -40,
        stagger: 0.1,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".dashboard-section",
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      // Benefit items - check circle draw effect
      gsap.from(".benefit-item", {
        opacity: 0,
        y: 40,
        stagger: 0.12,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".benefits-section",
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      // CTA section
      gsap.from(".cta-section-inner", {
        opacity: 0,
        scale: 0.95,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".cta-section",
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });


      // Sticky dashboard on desktop
      if (window.innerWidth >= 1024) {
        ScrollTrigger.create({
          trigger: ".dashboard-section",
          start: "top 15%",
          end: "bottom 50%",
          pin: ".dashboard-visual",
          pinSpacing: false,
        });
      }
    });

    return () => ctx.revert();
  }, []);
}
