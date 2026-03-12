# Granblue Fantasy Character Relations

This project is a community-driven, interactive web tool designed to visualize the complex web of relationships between characters in **Granblue Fantasy**.

The goal is to create a comprehensive and dynamic "conspiracy board" style graph that fans can explore and, most importantly, **contribute to and edit themselves**.

**Live Preview:** [**Website**](https://grin3671.github.io/gbf-relations/)

## Features

- **Interactive Graph:** Explore character connections in a visually appealing, force-directed graph. Click on nodes to see character details and highlight their immediate connections.
- **Community-Driven:** The entire dataset is open for editing. Anyone can submit changes or additions via Pull Requests.
- **Easy Data Editing:** All character and relationship data is stored in simple JSON files within the `public/data` directory. No coding knowledge is required to update the data!
- **Clear & Transparent:** All data contributions are tracked via Git, ensuring transparency and allowing for collaborative review.

## Data Structure & How to Contribute

The data for the graph is stored in the `public/data/` folder. This is the heart of the project, and we welcome your contributions to make it more complete!

To contribute:

1.  **Fork** this repository.
2.  Navigate to the `public/data/` folder.
3.  **Edit** the existing JSON files
4.  Submit a **Pull Request** back to the main repository.

## Tech Stack

- Framework: None

- Styling: CSS

- Language: JavaScript

- Graphing Library: [vis.js](https://github.com/visjs/vis-network)

## Local Development

To run this project locally:

1. Clone the repository:

```bash
git clone https://github.com/grin3671/gbf-relations.git
cd gbf-relations
```

2. Run via LiveServer in VSCode

## Legal Disclaimer and Fair Use
This project is a fan-made, non-commercial website created for educational and entertainment purposes only.

- U.S. Fair Use: This project utilizes character names, images, and lore from "Granblue Fantasy" to create a transformative work—a visual guide to character relationships. This is intended for commentary and research, and falls under the Fair Use Doctrine (17 U.S.C. § 107).

- No Affiliation: This project is not affiliated, endorsed, or sponsored by Cygames, Inc. or any of its licensors. "Granblue Fantasy" and all related characters, images, and elements are the exclusive property of Cygames, Inc.

- No Copyright Claim: We do not claim ownership of any of the copyrighted materials featured in this project. All rights and ownership of the "Granblue Fantasy" intellectual property belong to their respective owners.

- Content Removal: If you are a rights holder and believe that any material on this site infringes upon your copyright, please open an issue or contact the repository owner directly, and we will review and address your concern promptly.

## License
The code in this repository is licensed under the MIT License. The game assets (images, character names) are the property of their respective owners and are used here under the terms of fair use.
