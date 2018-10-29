.PHONY: clean

# get documentation.js with:
# npm install -g documentation
docs: ngPaneManager.js
	documentation build ngPaneManager.js -f html -o docs

clean: 
	rm -r docs
