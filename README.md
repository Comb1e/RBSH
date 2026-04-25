# PCA Implementation

## Introduction
This project provides a clean, reusable implementation of Principal Component Analysis (PCA) using scikit-learn. It accepts any 2D numeric array and returns both the dimensionality-reduced data and the principal components — enabling downstream analysis, visualization, or model preprocessing.

## Quick Start
1. Ensure `scikit-learn` and `numpy` are installed:
   ```bash
   pip install numpy scikit-learn
   ```
2. Place your input data as a 2D NumPy array or list of lists.
3. Call `perform_pca(data, n_components=2)` to reduce dimensions and retrieve components.
4. Verify output shapes: `transformed_data.shape[1] == n_components` and `components.shape[0] == n_components`.

Success criterion: Running `python ./output/main.py` prints transformed data and components without error.