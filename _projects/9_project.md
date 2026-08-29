---
layout: page
title: Traffic Police Gesture Recognition
description: 8-class pose classification from OpenPose skeletal features
img:
importance: 9
category: research
---

`Python` `OpenPose` `scikit-learn` `OpenCV` &nbsp;·&nbsp; Jun.–Aug. 2020 &nbsp;·&nbsp; USC INF 552

An end-to-end 8-class gesture-recognition pipeline. OpenPose BODY_25 keypoints
are transformed into 48-dimensional scale- and position-normalized features over
a verified 323-sample modeling dataset.

MLP, ExtraTrees, NuSVC, and HistGradientBoosting were compared across ten
randomized 60/40 splits; **ExtraTrees reached ~92.4% mean and 95.3% best test
accuracy**. Normalized confusion matrices drove the error analysis — class-level
errors, missing keypoints, class imbalance — and a Tkinter demo handles image
selection, skeleton display, and four-model prediction.
